#!/bin/bash

NODEJS_VERSION=$1
if [ -z "${NODEJS_VERSION}" ]
then
    echo "NODEJS_VERSION is a must argument"
    echo "usage: ${0} <nvmrc path>"
    exit 1
fi

ARCH=$(uname -m)
ARCH_TAG=""
if [[ "$ARCH" == "x86_64" ]]; then
    ARCH_TAG="x64"
elif [[ "$ARCH" == "aarch64" ]]; then
    ARCH_TAG="arm64"
else
    echo "unsupported: $ARCH"
    exit 1
fi

NODEJS_VERSION=v${NODEJS_VERSION}
FILE_NAME=node-${NODEJS_VERSION}-linux-${ARCH_TAG}.tar.xz
NODE_PATH="/usr/local/node"

mkdir -p ${NODE_PATH}
cd ${NODE_PATH}
curl -O https://nodejs.org/dist/${NODEJS_VERSION}/${FILE_NAME}
tar -xf ${FILE_NAME}

ln -s ${NODE_PATH}/node-${NODEJS_VERSION}-linux-${ARCH_TAG}/bin/node /usr/local/bin/node
ln -s ${NODE_PATH}/node-${NODEJS_VERSION}-linux-${ARCH_TAG}/bin/npm /usr/local/bin/npm
ln -s ${NODE_PATH}/node-${NODEJS_VERSION}-linux-${ARCH_TAG}/bin/npm /usr/local/bin/npx

rm ${FILE_NAME} 
