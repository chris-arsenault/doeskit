# ── Platform SSM lookups ─────────────────────────────────────

data "aws_ssm_parameter" "alb_listener_arn" {
  name = "/platform/network/alb-listener-arn"
}

data "aws_ssm_parameter" "alb_dns_name" {
  name = "/platform/network/alb-dns-name"
}

data "aws_ssm_parameter" "alb_zone_id" {
  name = "/platform/network/alb-zone-id"
}

data "aws_ssm_parameter" "route53_zone_id" {
  name = "/platform/network/route53-zone-id"
}

data "aws_ssm_parameter" "cognito_user_pool_id" {
  name = "/platform/cognito/user-pool-id"
}

# ── Cognito client (self-service per INTEGRATION.md Step 6) ──

resource "aws_cognito_user_pool_client" "app" {
  name         = "dosekit-app"
  user_pool_id = nonsensitive(data.aws_ssm_parameter.cognito_user_pool_id.value)

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}

# ── DynamoDB ─────────────────────────────────────────────────

resource "aws_dynamodb_table" "dosekit" {
  name         = "dosekit"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}

# ── Lambda IAM ───────────────────────────────────────────────

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda" {
  name               = "dosekit-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_dynamo" {
  name = "dosekit-lambda-dynamo"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ]
        Resource = [
          aws_dynamodb_table.dosekit.arn,
          "${aws_dynamodb_table.dosekit.arn}/index/*",
        ]
      }
    ]
  })
}

# ── Lambda function ──────────────────────────────────────────

resource "aws_lambda_function" "api" {
  function_name    = "dosekit-api"
  role             = aws_iam_role.lambda.arn
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  architectures    = ["arm64"]
  filename         = "${path.root}/../../backend/target/lambda/bootstrap/bootstrap.zip"
  source_code_hash = filebase64sha256("${path.root}/../../backend/target/lambda/bootstrap/bootstrap.zip")
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      DOSEKIT_TABLE = aws_dynamodb_table.dosekit.name
      RUST_LOG      = "info"
    }
  }
}

# ── ALB target group ────────────────────────────────────────

resource "aws_lb_target_group" "api" {
  name        = "dosekit-api-tg"
  target_type = "lambda"
}

resource "aws_lb_target_group_attachment" "api" {
  target_group_arn = aws_lb_target_group.api.arn
  target_id        = aws_lambda_function.api.arn
  depends_on       = [aws_lambda_permission.alb]
}

resource "aws_lambda_permission" "alb" {
  statement_id  = "AllowALBInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "elasticloadbalancing.amazonaws.com"
  source_arn    = aws_lb_target_group.api.arn
}

# ── ALB listener rules ──────────────────────────────────────

locals {
  cognito_pool_id = nonsensitive(data.aws_ssm_parameter.cognito_user_pool_id.value)
  cognito_issuer  = "https://cognito-idp.us-east-1.amazonaws.com/${local.cognito_pool_id}"
  cognito_jwks    = "${local.cognito_issuer}/.well-known/jwks.json"
}

# CORS preflight — OPTIONS must pass without auth (no Bearer token on preflight)
resource "aws_lb_listener_rule" "api_cors" {
  listener_arn = nonsensitive(data.aws_ssm_parameter.alb_listener_arn.value)
  priority     = 200

  condition {
    host_header {
      values = [local.api_domain]
    }
  }

  condition {
    http_request_method {
      values = ["OPTIONS"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# All other methods — JWT validation + forward
resource "aws_lb_listener_rule" "api" {
  listener_arn = nonsensitive(data.aws_ssm_parameter.alb_listener_arn.value)
  priority     = 201

  condition {
    host_header {
      values = [local.api_domain]
    }
  }

  action {
    type  = "jwt-validation"
    order = 1

    jwt_validation_config {
      jwks_endpoint = local.cognito_jwks
      issuer        = local.cognito_issuer
    }
  }

  action {
    type             = "forward"
    order            = 2
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ── TLS cert ────────────────────────────────────────────────

resource "aws_acm_certificate" "api" {
  domain_name       = local.api_domain
  validation_method = "DNS"
}

resource "aws_route53_record" "api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options :
    dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }

  zone_id = nonsensitive(data.aws_ssm_parameter.route53_zone_id.value)
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.value]
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for r in aws_route53_record.api_cert_validation : r.fqdn]
}

resource "aws_lb_listener_certificate" "api" {
  listener_arn    = nonsensitive(data.aws_ssm_parameter.alb_listener_arn.value)
  certificate_arn = aws_acm_certificate_validation.api.certificate_arn
}

# ── DNS ──────────────────────────────────────────────────────

resource "aws_route53_record" "api" {
  zone_id = nonsensitive(data.aws_ssm_parameter.route53_zone_id.value)
  name    = local.api_domain
  type    = "A"

  alias {
    name                   = nonsensitive(data.aws_ssm_parameter.alb_dns_name.value)
    zone_id                = nonsensitive(data.aws_ssm_parameter.alb_zone_id.value)
    evaluate_target_health = true
  }
}

# ── Frontend SPA ─────────────────────────────────────────────

module "frontend" {
  source = "./modules/spa-website"

  hostname            = local.hostname
  domain_name         = local.domain
  bucket_name         = local.frontend_bucket
  site_directory_path = "${path.root}/../../frontend/dist"

  runtime_config = {
    apiBaseUrl        = "https://${local.api_domain}"
    cognitoUserPoolId = local.cognito_pool_id
    cognitoClientId   = aws_cognito_user_pool_client.app.id
  }
}
