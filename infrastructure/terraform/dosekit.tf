# ── Per-project DB credentials (not in platform-context) ────

data "aws_ssm_parameter" "db_username" {
  name = "/ahara/db/dosekit/username"
}

data "aws_ssm_parameter" "db_password" {
  name = "/ahara/db/dosekit/password"
}

data "aws_ssm_parameter" "db_database" {
  name = "/ahara/db/dosekit/database"
}

# ── Platform context ────────────────────────────────────────

module "ctx" {
  source = "git::https://github.com/chris-arsenault/ahara-tf-patterns.git//modules/platform-context"
}

# ── Cognito client ──────────────────────────────────────────

module "cognito" {
  source  = "git::https://github.com/chris-arsenault/ahara-tf-patterns.git//modules/cognito-app"
  name    = "dosekit-app"
  cognito = module.ctx.cognito
}

# ── API ─────────────────────────────────────────────────────

module "api" {
  source   = "git::https://github.com/chris-arsenault/ahara-tf-patterns.git//modules/alb-api"
  prefix   = "dosekit"
  hostname = local.api_domain

  vpc     = module.ctx.vpc
  alb     = module.ctx.alb
  cognito = module.ctx.cognito

  environment = {
    DATABASE_URL = "postgresql://${nonsensitive(data.aws_ssm_parameter.db_username.value)}:${data.aws_ssm_parameter.db_password.value}@${module.ctx.rds_address}:${module.ctx.rds_port}/${nonsensitive(data.aws_ssm_parameter.db_database.value)}?sslmode=require"
    RUST_LOG     = "info"
  }

  lambdas = {
    api = {
      binary = "${path.root}/../../backend/target/lambda/dosekit/bootstrap"
      routes = [{ priority = 201, paths = ["/*"], authenticated = true }]
    }
  }
}

# ── Frontend SPA ────────────────────────────────────────────

module "frontend" {
  source         = "git::https://github.com/chris-arsenault/ahara-tf-patterns.git//modules/website"
  prefix         = "dosekit"
  hostname       = local.hostname
  site_directory = "${path.root}/../../frontend/dist"

  runtime_config = {
    apiBaseUrl        = "https://${local.api_domain}"
    cognitoUserPoolId = module.ctx.cognito_user_pool_id
    cognitoClientId   = module.cognito.client_id
  }
}
