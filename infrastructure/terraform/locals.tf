locals {
  domain          = "ahara.io"
  hostname        = "dosekit.ahara.io"
  api_domain      = "api.dosekit.ahara.io"
  frontend_bucket = "dosekit-frontend"

  cors_allow_origins = [
    "http://localhost:5173",
    "https://dosekit.ahara.io",
  ]
}
