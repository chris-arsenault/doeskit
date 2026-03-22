output "site_url" {
  description = "Frontend URL"
  value       = module.frontend.website_url
}

output "api_url" {
  description = "API URL (via shared ALB)"
  value       = "https://${local.api_domain}"
}

output "dynamodb_table" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.dosekit.name
}

output "lambda_function" {
  description = "Lambda function name"
  value       = aws_lambda_function.api.function_name
}
