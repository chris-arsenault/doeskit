locals {
  domain           = "ahara.io"
  hostname         = "dosekit.ahara.io"
  api_domain       = "api.dosekit.ahara.io"
  frontend_bucket  = "dosekit-frontend"

  cors_allow_origins = [
    "http://localhost:5173",
    "https://dosekit.ahara.io",
  ]

  lambda_runtime       = "provided.al2023"
  lambda_handler       = "bootstrap"
  lambda_architectures = ["arm64"]
  lambda_timeout       = 30
  lambda_memory        = 256

  # Cognito (shared platform user pool via SSM)
  cognito_user_pool_id = nonsensitive(data.aws_ssm_parameter.cognito_user_pool_id.value)
  cognito_client_id    = nonsensitive(data.aws_ssm_parameter.cognito_client_dosekit.value)
}
