#!/bin/bash
cd "$(dirname "$0")/.."
set -e
set -x

STAGE=$1
LABEL=$2

aws ecr-public get-login-password --region us-east-1 | docker login -u AWS --password-stdin $ECR_URL

docker pull $ECR_URL/$REPO_NAME:latest_${STAGE}_client || true
docker build --cache-from $ECR_URL/$REPO_NAME:latest_${STAGE}_client --tag ${LABEL}_client .