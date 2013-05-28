#!/usr/bin/env node
/*global require, __dirname, unescape, console */

(function (port) {
	'use strict';

	var path = require('path'),
		fs = require('fs'),
		_existsSync = fs.existsSync || path.existsSync, // Since Node 0.8, .existsSync() moved from path to fs
		formidable = require('formidable'),
		nodeStatic = require('node-static'),
		Utils = require('./commons/Utils.js'),
		options = {
			tmpDir: __dirname + '/../store/incoming',
			publicDir: __dirname + '/../store/public/photos',
			uploadDir: __dirname + '/../store/private/photos',
			uploadUrl: '/',
			maxPostSize: 11000000000, // 11 GB
			minFileSize: 1,
			maxFileSize: 10000000000, // 10 GB
			acceptFileTypes: /.+/i,
			// Files not matched by this regular expression force a download dialog,
			// to prevent executing any scripts in the context of the service domain:
			safeFileTypes: /\.(jpe?g|png)$/i,
			accessControl: {
				allowOrigin: '*',
				allowMethods: 'OPTIONS, HEAD, GET, POST, PUT, DELETE'
			},
			/* Uncomment and edit this section to provide the service via HTTPS:
			 ssl: {
			 key: fs.readFileSync('/Applications/XAMPP/etc/ssl.key/server.key'),
			 cert: fs.readFileSync('/Applications/XAMPP/etc/ssl.crt/server.crt')
			 },
			 */
			nodeStatic: {
				cache: 3600 // seconds to cache served files
			}
		},
		utf8encode = function (str) {
			return unescape(encodeURIComponent(str));
		},
		fileServer = new nodeStatic.Server(options.publicDir, options.nodeStatic),
		nameCountRegexp = /(?:(?: \(([\d]+)\))?(\.[^.]+))?$/,
		nameCountFunc = function (s, index, ext) {
			return ' (' + ((parseInt(index, 10) || 0) + 1) + ')' + (ext || '');
		},
		FileInfo = function (file) {
			this.name = file.name;
			this.file = Utils.randomString(36) + file.name.substr(file.name.lastIndexOf('.'));
			this.size = file.size;
			this.type = file.type;
		},
		UploadHandler = function (req, res, callback) {
			this.req = req;
			this.res = res;
			this.callback = callback;
		},
		serve = function (req, res) {
			res.setHeader(
				'Access-Control-Allow-Origin',
				options.accessControl.allowOrigin
			);
			res.setHeader(
				'Access-Control-Allow-Methods',
				options.accessControl.allowMethods
			);
			var handleResult = function (result, redirect) {
					if (redirect) {
						res.writeHead(302, {
							'Location': redirect.replace(
								/%s/,
								encodeURIComponent(JSON.stringify(result))
							)
						});
						res.end();
					} else {
						res.writeHead(200, {
							'Content-Type': req.headers.accept.indexOf('application/json') !== -1 ? 'application/json' : 'text/plain'
						});
						res.end(JSON.stringify(result));
					}
				},
				setNoCacheHeaders = function () {
					res.setHeader('Pragma', 'no-cache');
					res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
					res.setHeader('Content-Disposition', 'inline; filename="files.json"');
				},
				handler = new UploadHandler(req, res, handleResult);
			switch (req.method) {
			case 'OPTIONS':
				res.end();
				break;
			case 'HEAD':
			case 'GET':
				if (req.url === '/') {
					setNoCacheHeaders();
					if (req.method === 'GET') {
						handler.get();
					} else {
						res.end();
					}
				} else {
					fileServer.serve(req, res);
				}
				break;
			case 'POST':
				setNoCacheHeaders();
				handler.post();
				break;
			case 'DELETE':
				handler.destroy();
				break;
			default:
				res.statusCode = 405;
				res.end();
			}
		};
	console.dir(options);
	fileServer.respond = function (pathname, status, _headers, files, stat, req, res, finish) {
		if (!options.safeFileTypes.test(files[0])) {
			// Force a download dialog for unsafe file extensions:
			res.setHeader(
				'Content-Disposition',
				'attachment; filename="' + utf8encode(path.basename(files[0])) + '"'
			);
		} else {
			// Prevent Internet Explorer from MIME-sniffing the content-type:
			res.setHeader('X-Content-Type-Options', 'nosniff');
		}
		nodeStatic.Server.prototype.respond
			.call(this, pathname, status, _headers, files, stat, req, res, finish);
	};
	FileInfo.prototype.validate = function () {
		if (options.minFileSize && options.minFileSize > this.size) {
			this.error = 'File is too small';
		} else if (options.maxFileSize && options.maxFileSize < this.size) {
			this.error = 'File is too big';
		} else if (!options.acceptFileTypes.test(this.name)) {
			this.error = 'Filetype not allowed';
		}
		return !this.error;
	};
	FileInfo.prototype.safeName = function () {
		// Prevent directory traversal and creating hidden system files:
		this.file = path.basename(this.file).replace(/^\.+/, '');
		// Prevent overwriting existing files:
		while (_existsSync(options.uploadDir + '/origin/' + this.file)) {
			this.file = this.file.replace(nameCountRegexp, nameCountFunc);
		}
	};
	FileInfo.prototype.initUrls = function (req) {
		console.log(66);
		if (!this.error) {
			var baseUrl = (options.ssl ? 'https:' : 'http:') + '//' + req.headers.host + options.uploadUrl;
			this.url = baseUrl + 'origin/' + encodeURIComponent(this.file);
		}
	};
	UploadHandler.prototype.get = function () {
		var handler = this,
			files = [];
		console.log(1);
		fs.readdir(options.uploadDir + '/origin', function (err, list) {
			list.forEach(function (name) {
				var stats = fs.statSync(options.uploadDir + '/origin/' + name),
					fileInfo;
				if (stats.isFile()) {
					fileInfo = new FileInfo({
						name: name,
						size: stats.size
					});
					fileInfo.initUrls(handler.req);
					files.push(fileInfo);
				}
			});
			handler.callback({files: files});
		});
	};
	UploadHandler.prototype.post = function () {
		console.log(2);
		var handler = this,
			form = new formidable.IncomingForm(),
			tmpFiles = [],
			files = [],
			map = {},
			counter = 1,
			redirect,
			finish = function () {
				counter -= 1;
				if (!counter) {
					files.forEach(function (fileInfo) {
						fileInfo.initUrls(handler.req);
					});
					handler.callback({files: files}, redirect);
				}
			};
		form.uploadDir = options.tmpDir;
		form
			.on('fileBegin',function (name, file) {
				console.log(3);
				tmpFiles.push(file.path);
				var fileInfo = new FileInfo(file, handler.req, true);
				fileInfo.safeName();
				map[path.basename(file.path)] = fileInfo;
				files.push(fileInfo);
			}).on('field',function (name, value) {
				console.log(4);
				if (name === 'redirect') {
					redirect = value;
				}
			}).on('file',function (name, file) {
				console.log(5);
				var fileInfo = map[path.basename(file.path)];
				console.dir(fileInfo);
				console.dir(file.path);

				fileInfo.size = file.size;
				if (!fileInfo.validate()) {
					fs.unlink(file.path);
					return;
				}
				fs.renameSync(file.path, options.uploadDir + '/origin/' + fileInfo.file);
			}).on('aborted',function () {
				console.log(6);
				tmpFiles.forEach(function (file) {
					fs.unlink(file);
				});
			}).on('error',function (e) {
				console.log(7);
				console.log(e);
			}).on('progress',function (bytesReceived, bytesExpected) {
				console.log(8);
				if (bytesReceived > options.maxPostSize) {
					handler.req.connection.destroy();
				}
			}).on('end', finish).parse(handler.req);
	};
	UploadHandler.prototype.destroy = function () {
		console.log(9);
		var handler = this,
			fileName;
		if (handler.req.url.slice(0, options.uploadUrl.length) === options.uploadUrl) {
			fileName = path.basename(decodeURIComponent(handler.req.url));
			fs.unlink(options.uploadDir + '/origin/' + fileName, function (ex) {
				handler.callback({success: !ex});
			});
		} else {
			handler.callback({success: false});
		}
	};
	if (options.ssl) {
		require('https').createServer(options.ssl, serve).listen(port);
	} else {
		require('http').createServer(serve).listen(port);
	}
}(8888));
