"use strict";

var _ = require('lodash');
var request = require('request');
var fs = require('fs');
var crypto = require('crypto');
var os = require('os');
var P = require('../../util/promise');
var ec2_wrap = require('../../deploy/ec2_wrapper');
var promise_utils = require('../../util/promise_utils');
var api = require('../../api');

var test_file = '/tmp/test_upgrade';
var rpc = api.new_rpc();

module.exports = {
    upload_and_upgrade: upload_and_upgrade,
    wait_for_server: wait_for_server,
    get_agent_setup: get_agent_setup,
    upload_file: upload_file,
    download_file: download_file,
    verify_upload_download: verify_upload_download,
    generate_random_file: generate_random_file,
    wait_on_agents_upgrade: wait_on_agents_upgrade,
    calc_md5: calc_md5,
};


function upload_and_upgrade(ip, upgrade_pack) {
    console.log('Upgrading the machine');

    var filename;
    if (upgrade_pack.indexOf('/') !== -1) {
        filename = upgrade_pack.substring(upgrade_pack.indexOf('/'));
    } else {
        filename = upgrade_pack;
    }

    var formData = {
        upgrade_file: {
            value: fs.createReadStream(upgrade_pack),
            options: {
                filename: filename,
                contentType: 'application/x-gzip'
            }
        }
    };

    return P.ninvoke(request, 'post', {
            url: 'http://' + ip + ':8080/upgrade',
            formData: formData,
            rejectUnauthorized: false,
        })
        .then(res => console.log('Upload package successful', res.statusCode))
        .then(() => P.delay(10000))
        .then(() => wait_for_server(ip))
        .then(() => P.delay(10000))
        .then(() => {
            var isNotListening = true;
            return promise_utils.pwhile(
                function() {
                    return isNotListening;
                },
                function() {
                    return P.ninvoke(request, 'get', {
                        url: 'http://' + ip + ':80/',
                        rejectUnauthorized: false,
                    }).then(res => {
                        console.log('S3 server started after upgrade');
                        isNotListening = false;
                    }, err => {
                        console.log('waiting for S3 server to start');
                        return P.delay(10000);
                    });
                });
        })
        .catch(err => {
            console.error('Upload package failed', err, err.stack);
            throw new Error('Upload package failed ' + err);
        });
}

function wait_for_server(ip, wait_for_version) {
    var isNotListening = true;
    var version;
    return promise_utils.pwhile(
        function() {
            return isNotListening;
        },
        function() {
            console.log('waiting for Web Server to start');
            return P.fromCallback(callback => request({
                    method: 'get',
                    url: 'http://' + ip + ':8080/version',
                    strictSSL: false,
                }, callback), {
                    multiArgs: true
                })
                .spread(function(response, body) {
                    if (response.statusCode !== 200) {
                        throw new Error('got error code ' + response.statusCode);
                    }
                    if (wait_for_version && body !== wait_for_version) {
                        throw new Error('version is ' + body +
                            ' wait for version ' + wait_for_version);
                    }
                    console.log('Web Server started. version is: ' + body);
                    version = body;
                    isNotListening = false;
                })
                .catch(function(err) {
                    console.log('not up yet...', err.message);
                    return P.delay(5000);
                });
        }).return(version);
}

function get_agent_setup(ip) {
    return P.ninvoke(request, 'get', {
            url: 'https://' + ip + ':8443/public/noobaa-setup.exe',
            rejectUnauthorized: false,
        })
        .then(function(response) {
            console.log('Download of noobaa-setup was successful');
            return;
        })
        .then(null, function(err) {
            console.error('Download of noobaa-setup failed', err);
            throw new Error('Download of noobaa-setup failed ' + err);
        });
}

function upload_file(ip, path, bucket, key) {
    return P.fcall(function() {
            //verify the 'demo' system exists on the instance
            return ec2_wrap.verify_demo_system(ip);
        })
        .then(function() {
            //upload the file
            return P.fcall(function() {
                    return ec2_wrap.put_object(ip, path, bucket, key);
                })
                .then(function() {
                    console.log('Upload file successfully');
                })
                .then(null, function(err) {
                    console.error('Error in upload_file', err);
                    throw new Error('Error in upload_file ' + err);
                });
        })
        .then(null, function(err) {
            console.error('Error in verify_demo_system', err, err.stack);
            throw new Error('Error in verify_demo_system ' + err);
        });
}

function download_file(ip, path) {
    return P.fcall(function() {
            //verify the 'demo' system exists on the instance
            return ec2_wrap.verify_demo_system(ip);
        })
        .then(function() {
            //download the file
            return P.fcall(function() {
                    return ec2_wrap.get_object(ip, path);
                })
                .then(function() {
                    console.log('Download file successfully');
                    return;
                })
                .then(null, function(err) {
                    console.error('Error in download_file', err);
                    throw new Error('Error in download_file ' + err);
                });
        })
        .then(null, function(err) {
            console.error('Error in verify_demo_system', err);
            throw new Error('Error in verify_demo_system ' + err);
        });
}

function verify_upload_download(ip, path) {
    var orig_md5;
    var down_path = path + '_download';
    return P.resolve(calc_md5(path))
        .then(function(md5) {
            orig_md5 = md5;
            return upload_file(ip, path);
        })
        .catch(function(err) {
            console.warn('Failed to upload file', path, 'with err', err, err.stack);
        })
        .then(function() {
            return download_file(ip, down_path);
        })
        .catch(function(err) {
            console.warn('Failed to download file with err', err, err.stack);
        })
        .then(function() {
            return P.resolve(calc_md5(down_path));
        })
        .then(function(md5) {
            if (md5 === orig_md5) {
                console.log('Original and downloaded file MDs are the same');
                return P.resolve();
            } else {
                console.warn('Original and downloaded file MDs are different');
                return P.reject();
            }
        });
}


function generate_random_file(size_mb, extension) {
    extension = extension || '.dat';
    let ext_regex = /^\.[A-Za-z0-9_]{1,4}$/;
    if (!extension.startsWith('.')) extension = '.' + extension;
    if (!ext_regex.test(extension)) return P.reject();
    var suffix = Date.now() + '.' + Math.round(Math.random() * 1000) + extension;
    var fname = test_file + suffix;
    var dd_cmd;

    if (os.type() === 'Darwin') {
        dd_cmd = 'dd if=/dev/urandom of=' + fname + ' count=' + size_mb + ' bs=1m';
    } else if (os.type() === 'Linux') {
        dd_cmd = 'dd if=/dev/urandom of=' + fname + ' count=' + size_mb + ' bs=1M';
    }

    return promise_utils.exec(dd_cmd)
        .then(function() {
            return fname;
        });
}

function wait_on_agents_upgrade(ip) {
    var client = rpc.new_client({
        address: 'ws://' + ip + ':8080'
    });
    var sys_ver;

    return P.fcall(function() {
            var auth_params = {
                email: 'demo@noobaa.com',
                password: 'DeMo1',
                system: 'demo'
            };
            return client.create_auth_token(auth_params);
        })
        .then(function() {
            return P.resolve(client.system.read_system({}))
                .then(function(res) {
                    sys_ver = res.version;
                });
        })
        .catch(function(error) {
            console.warn('Failed with', error, error.stack);
            throw error;
        })
        .then(function() {
            //Loop on list_agents until all agents version was updated
            //Timeout at 10 minutes
            var old_agents = true;
            var wait_time = 0;
            return P.delay(5000).then(function() {
                return promise_utils.pwhile(
                    function() {
                        return old_agents;
                    },
                    function() {
                        return P.resolve(client.node.list_nodes({
                                query: {
                                    online: true,
                                }
                            }))
                            .then(function(res) {
                                old_agents = false;
                                _.each(res.nodes, function(n) {
                                    if (n.version !== sys_ver) {
                                        old_agents = true;
                                    }
                                });
                                if (old_agents) {
                                    if (wait_time >= 120) {
                                        throw new Error('Timeout while waiting for agents to upgrade');
                                    }
                                    console.log('waiting for agents to upgrade');
                                    wait_time += 5;
                                    return P.delay(5000);
                                }
                            });
                    });
            });
        });
}

function calc_md5(path) {
    var hash = crypto.createHash('md5');
    var stream = fs.createReadStream(path);

    stream.on('data', function(data) {
        hash.update(data, 'utf8');
    });

    stream.on('end', function() {
        return P.resolve(hash.digest('hex'));
    });
}
