/* Copyright (C) 2016 NooBaa */
"use strict";

const { S3A_TEST } = require('./s3a_constants');
const { create_account, create_bucket } = require('../nc_test_utils');

async function main() {
    try {
        await s3a_test_setup();
    } catch (err) {
        console.error(`S3A Setup Failed: ${err}`);
        process.exit(1);
    }
    process.exit(0);
}

async function s3a_test_setup() {
    console.info('S3A TEST CONFIGURATION:', JSON.stringify(S3A_TEST));
    await create_account(S3A_TEST.nc_s3a_account_params);
    await create_bucket(S3A_TEST.nc_s3a_bucket_params);
    console.info('S3A TEST SETUP DONE');
}

if (require.main === module) {
    main();
}
