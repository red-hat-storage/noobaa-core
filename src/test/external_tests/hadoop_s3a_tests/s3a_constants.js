/* Copyright (C) 2016 NooBaa */
'use strict';

const s3a_account_name = 's3a-user';
const s3a_bucket_name = 's3a-test';

const FS_ROOT = '/nsfs/buckets/';
const S3A_ACCESS_KEY = 'hadoopS3aAccessKey01';
const S3A_SECRET_KEY = 'hadoopS3aSecretKey0000000000000000000000';

const S3A_TEST = {
    nc_s3a_account_params: {
        name: s3a_account_name,
        uid: 0,
        gid: 0,
        new_buckets_path: FS_ROOT,
        access_key: S3A_ACCESS_KEY,
        secret_key: S3A_SECRET_KEY
    },
    nc_s3a_bucket_params: {
        name: s3a_bucket_name,
        owner: s3a_account_name,
        path: `${FS_ROOT}${s3a_bucket_name}/`,
    },
};

exports.S3A_TEST = S3A_TEST;
exports.S3A_ACCESS_KEY = S3A_ACCESS_KEY;
exports.S3A_SECRET_KEY = S3A_SECRET_KEY;
exports.FS_ROOT = FS_ROOT;
