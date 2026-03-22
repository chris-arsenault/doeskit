#!/usr/bin/env bash
# ensure-state-bucket.sh - Create/verify the S3 state bucket for Terraform remote state.
#
# Usage:
#   source scripts/ensure-state-bucket.sh
#
# The bucket name and region are hardcoded to match main.tf backend config.

set -euo pipefail

STATE_BUCKET="ahara-terraform-state"
STATE_REGION="us-east-1"

echo "State bucket: ${STATE_BUCKET}"
echo "State region: ${STATE_REGION}"

if aws s3api head-bucket --bucket "${STATE_BUCKET}" 2>/dev/null; then
  echo "Bucket already exists."
else
  echo "Creating state bucket: ${STATE_BUCKET}"
  aws s3api create-bucket \
    --bucket "${STATE_BUCKET}" \
    --region "${STATE_REGION}"

  aws s3api put-bucket-versioning \
    --bucket "${STATE_BUCKET}" \
    --versioning-configuration Status=Enabled

  aws s3api put-public-access-block \
    --bucket "${STATE_BUCKET}" \
    --public-access-block-configuration \
      BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

  echo "Bucket created with versioning and public access block."
fi
