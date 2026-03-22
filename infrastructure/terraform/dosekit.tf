# ── Platform SSM lookups ─────────────────────────────────────

data "aws_ssm_parameter" "cognito_user_pool_id" {
  name = "/platform/cognito/user-pool-id"
}

data "aws_ssm_parameter" "cognito_client_id" {
  name = "/platform/cognito/dosekit-client-id"
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

# ── API Lambda ───────────────────────────────────────────────

module "api" {
  source = "./modules/api-http"

  name                 = "dosekit"
  lambda_zip_path      = "${path.root}/../../backend/target/lambda/bootstrap/bootstrap.zip"
  lambda_runtime       = local.lambda_runtime
  lambda_handler       = local.lambda_handler
  lambda_architectures = local.lambda_architectures
  lambda_timeout       = local.lambda_timeout
  lambda_memory        = local.lambda_memory

  lambda_environment = {
    DOSEKIT_TABLE = aws_dynamodb_table.dosekit.name
    RUST_LOG      = "info"
  }

  iam_policy_json = data.aws_iam_policy_document.lambda_permissions.json

  routes = [
    "GET /api/health",
    "GET /api/today",
    "POST /api/log",
    "GET /api/supplements",
    "POST /api/supplements",
    "DELETE /api/supplements/{id}",
    "GET /api/cycles",
    "POST /api/cycles",
    "DELETE /api/cycles/{id}",
    "GET /api/history",
  ]

  cors_allow_origins  = local.cors_allow_origins
  custom_domain_name  = local.api_domain
  domain_zone_name    = local.domain

  jwt_issuer   = "https://cognito-idp.us-east-1.amazonaws.com/${local.cognito_user_pool_id}"
  jwt_audience = [local.cognito_client_id]
}

data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]
    resources = [
      aws_dynamodb_table.dosekit.arn,
      "${aws_dynamodb_table.dosekit.arn}/index/*",
    ]
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
    cognitoUserPoolId = local.cognito_user_pool_id
    cognitoClientId   = local.cognito_client_id
  }
}
