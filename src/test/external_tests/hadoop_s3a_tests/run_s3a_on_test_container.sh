#!/bin/bash

export PS4='\e[36m+ ${FUNCNAME:-main}\e[0m@\e[32m${BASH_SOURCE}:\e[35m${LINENO} \e[0m'

set -e
set -x

# ====================================================================================
# Set the environment variables
export ENDPOINT_PORT=6001
export ENDPOINT_SSL_PORT=6443
export S3_SERVICE_HOST=localhost

export CONFIG_DIR=/etc/noobaa.conf.d/
export FS_ROOT=/nsfs/buckets/

# ====================================================================================

# 1. Create configuration directory
# 2. Create config.json file
mkdir -p ${CONFIG_DIR}
config='{"ALLOW_HTTP":true}'
echo "$config" > ${CONFIG_DIR}/config.json

# 1. Create root directory for bucket creation
# 2. Create the S3A test bucket directory
mkdir -p ${FS_ROOT}
mkdir -p ${FS_ROOT}/s3a-test
chmod 777 ${FS_ROOT}
chmod 777 ${FS_ROOT}/s3a-test

# ====================================================================================

# Deploy standalone NooBaa NSFS on the test container
./src/deploy/NVA_build/standalone_deploy_nsfs.sh

# ====================================================================================

cd /root/node_modules/noobaa-core/

# Configure the S3A test account and bucket
node ./src/test/external_tests/hadoop_s3a_tests/configure_s3a.js
