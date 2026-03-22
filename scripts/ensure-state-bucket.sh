#!/usr/bin/env bash
# ensure-state-bucket.sh - Create/verify the S3 state bucket for Terraform remote state.
# Follows platform-control naming convention: tf-state-{prefix}-{account_id}
#
# Usage:
#   source scripts/ensure-state-bucket.sh
#
# Exports STATE_BUCKET and STATE_REGION for use in deploy.sh.

set -euo pipefail

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
STATE_BUCKET="${STATE_BUCKET:-tf-state-dosekit-${AWS_ACCOUNT_ID}}"
STATE_REGION="${STATE_REGION:-us-east-1}"

export STATE_BUCKET STATE_REGION

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
