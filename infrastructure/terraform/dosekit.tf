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

data "aws_ssm_parameter" "vpc_id" {
  name = "/platform/network/vpc-id"
}

data "aws_subnets" "private" {
  filter {
    name   = "tag:subnet:access"
    values = ["private"]
  }
}

data "aws_ssm_parameter" "rds_address" {
  name = "/platform/rds/address"
}

data "aws_ssm_parameter" "rds_port" {
  name = "/platform/rds/port"
}

data "aws_ssm_parameter" "db_username" {
  name = "/platform/db/dosekit/username"
}

data "aws_ssm_parameter" "db_password" {
  name = "/platform/db/dosekit/password"
}

data "aws_ssm_parameter" "db_database" {
  name = "/platform/db/dosekit/database"
}

# ── VAPID keys for Web Push ──────────────────────────────────

resource "tls_private_key" "vapid" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
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

# ── Lambda security group ───────────────────────────────────

resource "aws_security_group" "lambda" {
  name        = "dosekit-lambda"
  description = "Dosekit API Lambda"
  vpc_id      = nonsensitive(data.aws_ssm_parameter.vpc_id.value)

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
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

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# ── Lambda function ──────────────────────────────────────────

resource "aws_lambda_function" "api" {
  function_name    = "dosekit-api"
  role             = aws_iam_role.lambda.arn
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  architectures    = ["x86_64"]
  filename         = "${path.root}/../../backend/target/lambda/bootstrap/bootstrap.zip"
  source_code_hash = filebase64sha256("${path.root}/../../backend/target/lambda/bootstrap/bootstrap.zip")
  timeout          = 30
  memory_size      = 256

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DATABASE_URL      = "postgresql://${nonsensitive(data.aws_ssm_parameter.db_username.value)}:${data.aws_ssm_parameter.db_password.value}@${nonsensitive(data.aws_ssm_parameter.rds_address.value)}:${nonsensitive(data.aws_ssm_parameter.rds_port.value)}/${nonsensitive(data.aws_ssm_parameter.db_database.value)}?sslmode=require"
      RUST_LOG          = "info"
      VAPID_PRIVATE_PEM = tls_private_key.vapid.private_key_pem
      VAPID_EMAIL       = "admin@ahara.io"
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

# CORS preflight (OPTIONS) handled platform-wide by platform-network.

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
    type = "jwt-validation"

    jwt_validation {
      issuer        = local.cognito_issuer
      jwks_endpoint = local.cognito_jwks
    }
  }

  action {
    type             = "forward"
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

# ── Notification check (no auth — triggered by EventBridge) ──

resource "aws_lb_listener_rule" "notification_check" {
  listener_arn = nonsensitive(data.aws_ssm_parameter.alb_listener_arn.value)
  priority     = 199

  condition {
    host_header {
      values = [local.api_domain]
    }
  }

  condition {
    path_pattern {
      values = ["/notifications/check"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ── Scheduled notification check ─────────────────────────────

resource "aws_scheduler_schedule" "notification_check" {
  name       = "dosekit-notification-check"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(15 minutes)"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:lambda:invoke"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      FunctionName   = aws_lambda_function.api.function_name
      InvocationType = "Event"
      Payload = jsonencode({
        httpMethod            = "POST"
        path                  = "/notifications/check"
        queryStringParameters = { tz_offset = "-240" }
        headers               = { "content-type" = "application/json" }
        body                  = ""
        isBase64Encoded       = false
      })
    })
  }
}

resource "aws_iam_role" "scheduler" {
  name = "dosekit-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  name = "invoke-lambda"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.api.arn
    }]
  })
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
