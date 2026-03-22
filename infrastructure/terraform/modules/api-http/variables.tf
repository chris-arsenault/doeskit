variable "name" {
  description = "Base name for API resources"
  type        = string
}

variable "lambda_zip_path" {
  description = "Path to the pre-built Lambda deployment zip"
  type        = string
}

variable "lambda_runtime" {
  description = "Lambda runtime (e.g., provided.al2023 for Rust)"
  type        = string
}

variable "lambda_handler" {
  description = "Lambda handler (e.g., bootstrap for Rust custom runtime)"
  type        = string
}

variable "lambda_architectures" {
  description = "Lambda instruction set architecture (e.g., [arm64] for Graviton)"
  type        = list(string)
  default     = ["arm64"]
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_memory" {
  description = "Lambda function memory in MB"
  type        = number
  default     = 256
}

variable "lambda_environment" {
  description = "Environment variables for Lambda"
  type        = map(string)
}

variable "iam_policy_json" {
  description = "Inline policy JSON for the Lambda role"
  type        = string
}

variable "routes" {
  description = "List of HTTP routes (e.g., GET /items)"
  type        = list(string)
}

variable "cors_allow_origins" {
  description = "CORS allowed origins"
  type        = list(string)
}

variable "custom_domain_name" {
  description = "Custom domain name for the API"
  type        = string
}

variable "domain_zone_name" {
  description = "Route53 hosted zone name for the custom domain"
  type        = string
}

variable "jwt_issuer" {
  description = "JWT issuer URL for API Gateway authorizer (e.g. Cognito pool URL). Null disables auth."
  type        = string
  default     = null
}

variable "jwt_audience" {
  description = "JWT audience (e.g. Cognito app client ID). Required if jwt_issuer is set."
  type        = list(string)
  default     = []
}
