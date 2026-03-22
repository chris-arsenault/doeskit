output "site_url" {
  description = "Frontend URL"
  value       = module.frontend.website_url
}

output "api_endpoint" {
  description = "API Gateway endpoint"
  value       = module.api.api_endpoint
}

output "dynamodb_table" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.dosekit.name
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = local.cognito_user_pool_id
}

output "cognito_client_id" {
  description = "Cognito Client ID"
  value       = local.cognito_client_id
}
