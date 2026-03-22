output "site_url" {
  description = "Frontend URL"
  value       = module.frontend.website_url
}

output "api_url" {
  description = "API URL (via shared ALB)"
  value       = "https://${local.api_domain}"
}

output "lambda_function" {
  description = "Lambda function name"
  value       = aws_lambda_function.api.function_name
}
