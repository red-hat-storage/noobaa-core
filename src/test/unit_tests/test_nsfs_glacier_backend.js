/* Copyright (C) 2024 NooBaa */
'use strict';

const fs = require('fs');
const util = require('util');
const path = require('path');
const mocha = require('mocha');
const crypto = require('crypto');
const assert = require('assert');
const os = require('os');
const config = require('../../../config');
const NamespaceFS = require('../../sdk/namespace_fs');
const s3_utils = require('../../endpoint/s3/s3_utils');
const buffer_utils = require('../../util/buffer_utils');
const endpoint_stats_collector = require('../../sdk/endpoint_stats_collector');
const { NewlineReader } = require('../../util/file_reader');
const { TapeCloudGlacierBackend } = require('../../sdk/nsfs_glacier_backend/tapecloud');

const mkdtemp = util.promisify(fs.mkdtemp);
const inspect = (x, max_arr = 5) => util.inspect(x, { colors: true, depth: null, maxArrayLength: max_arr });

function make_dummy_object_sdk() {
    return {
        requesting_account: {
            force_md5_etag: false,
            nsfs_account_config: {
                uid: process.getuid(),
                gid: process.getgid(),
            }
        },
        abort_controller: new AbortController(),
        throw_if_aborted() {
            if (this.abort_controller.signal.aborted) throw new Error('request aborted signal');
        }
    };
}

mocha.describe('nsfs_glacier', async () => {
	const src_bkt = 'src';

	const dummy_object_sdk = make_dummy_object_sdk();
    const upload_bkt = 'test_ns_uploads_object';
	const ns_src_bucket_path = `./${src_bkt}`;

	const glacier_ns = new NamespaceFS({
		bucket_path: ns_src_bucket_path,
		bucket_id: '1',
		namespace_resource_id: undefined,
		access_mode: undefined,
		versioning: undefined,
		force_md5_etag: false,
		stats: endpoint_stats_collector.instance(),
	});

	glacier_ns._is_storage_class_supported = async () => true;

	mocha.before(async () => {
		config.NSFS_GLACIER_LOGS_DIR = await mkdtemp(path.join(os.tmpdir(), 'nsfs-wal-'));
	});

	mocha.describe('nsfs_glacier_tapecloud', async () => {
        const upload_key = 'upload_key_1';
        const restore_key = 'restore_key_1';
        const xattr = { key: 'value', key2: 'value2' };
        xattr[s3_utils.XATTR_SORT_SYMBOL] = true;

		const backend = new TapeCloudGlacierBackend();

		// Patch backend for test
		backend._migrate = async () => [];
		backend._recall = async () => [];
		backend._process_expired = async () => { /**noop*/ };

		mocha.it('upload to GLACIER should work', async () => {
            const data = crypto.randomBytes(100);
            const upload_res = await glacier_ns.upload_object({
                bucket: upload_bkt,
                key: upload_key,
				storage_class: s3_utils.STORAGE_CLASS_GLACIER,
                xattr,
                source_stream: buffer_utils.buffer_to_read_stream(data)
            }, dummy_object_sdk);

            console.log('upload_object response', inspect(upload_res));

			// Force a swap, 3 cases are possible:
			// 1. The file was already swapped - Unlikely but whatever
			// 2. The file was empty (bug) - swap returns without doing anything
			// 3. The file is swapped successfully
			await NamespaceFS.migrate_wal._swap();

			// Check if the log contains the entry
			let found = false;
			await NamespaceFS.migrate_wal.process_inactive(async file => {
				const fs_context = glacier_ns.prepare_fs_context(dummy_object_sdk);
				const reader = new NewlineReader(fs_context, file, 'EXCLUSIVE');

				await reader.forEachFilePathEntry(async entry => {
					if (entry.path.endsWith(`${upload_key}`)) {
						found = true;

						// Not only should the file exist, it should be ready for
						// migration as well
						assert(backend.should_migrate(fs_context, entry.path));
					}

					return true;
				});

				// Don't delete the file
				return false;
			});

			assert(found);
		});

		mocha.it('restore-object should successfully restore', async () => {
            const data = crypto.randomBytes(100);
			const params = {
                bucket: upload_bkt,
                key: restore_key,
				storage_class: s3_utils.STORAGE_CLASS_GLACIER,
                xattr,
				days: 1,
                source_stream: buffer_utils.buffer_to_read_stream(data)
            };

            const upload_res = await glacier_ns.upload_object(params, dummy_object_sdk);
            console.log('upload_object response', inspect(upload_res));

			const restore_res = await glacier_ns.restore_object(params, dummy_object_sdk);
			assert(restore_res);

			// Force a swap, 3 cases are possible:
			// 1. The file was already swapped - Unlikely but whatever
			// 2. The file was empty (bug) - swap returns without doing anything
			// 3. The file is swapped successfully
			await NamespaceFS.restore_wal._swap();

			// Issue restore
			await NamespaceFS.restore_wal.process_inactive(async file => {
				const fs_context = glacier_ns.prepare_fs_context(dummy_object_sdk);
				await backend.restore(fs_context, file);

				// Don't delete the file
				return false;
			});

			// Ensure object is restored
			const md = await glacier_ns.read_object_md(params, dummy_object_sdk);
			assert(!md.restore_status.ongoing);
			assert(new Date(new Date().setDate(md.restore_status.expiry_time.getDate() - params.days)).getDate() === new Date().getDate());
		});
	});
});
