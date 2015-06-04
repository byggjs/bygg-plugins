'use strict';

var bygglib = require('bygg/lib');
var browserify = require('browserify');
var fs = require('fs');
var extend = require('extend');
var path = require('path');
var convertSourceMap = require('convert-source-map');
var through = require('through2');

module.exports = function (options) {
    options = options || {};
    var configure = options.configure || function () {};
    delete options.configure;

    var bundles = [];

    return function (tree) {
        var output = bygglib.signal();
        var processed = 0;

        var render = function (bundle, entrypointNode) {
            bundle.watched = [];
            var start = new Date();

            var b = browserify(extend({}, options, {
                basedir: entrypointNode.base,
                cache: bundle.cache,
                debug: true
            }));

            configure(b);

            b.add(bundle.entrypoint);

            cacheBuilder(bundle, b);

            b.on('file', function (file) {
                watch(bundle, file);
            });

            b.on('package', function (pkg) {
                watch(bundle, path.join(pkg.__dirname, 'package.json'));
            });

            b.bundle(function (err, buf) {
                if (err) { bygglib.logger.error('browserify', err.message); return; }

                bundle.watcher.watch(bundle.watched);

                // Result
                var outputNode = bygglib.tree.cloneNode(entrypointNode);
                var outputPrefix = path.dirname(entrypointNode.name) + '/';
                outputPrefix = (outputPrefix === './') ? '' : outputPrefix;
                outputNode.name = outputPrefix + path.basename(entrypointNode.name, path.extname(entrypointNode.name)) + '.js';
                outputNode.metadata.mime = 'application/javascript';

                var data = buf.toString('utf-8');
                var outputBundle = convertSourceMap.removeComments(data);
                outputNode.data = new Buffer(outputBundle, 'utf-8');

                // Source map
                var sourceMap = convertSourceMap.fromSource(data).toObject();
                sourceMap.sources = sourceMap.sources.map(function (source) {
                    return (source[0] === '/') ? path.relative(entrypointNode.base, source) : source;
                });
                outputNode = bygglib.tree.sourceMap.set(outputNode, sourceMap, { sourceBase: outputPrefix });

                bygglib.logger.log('browserify', 'Bundled ' + outputNode.name, new Date() - start);

                // Push upstream if required
                if (bundle.outputNode === undefined) {
                    processed++;
                }
                bundle.outputNode = outputNode;
                if (processed === tree.nodes.length) {
                    output.push(bygglib.tree(bundles.map(function (bundle) {
                        return bundle.outputNode;
                    })));
                }
            });
         };

        // Stolen from watchify
        var cacheBuilder = function (bundle, b) {
            b.pipeline.get('deps').push(through.obj(function(row, enc, next) {
                var file = row.expose ? b._expose[row.id] : row.file;
                bundle.cache[file] = {
                    source: row.source,
                    deps: extend({}, row.deps)
                };
                this.push(row);
                next();
            }));
        };

        var watch = function (bundle, path) {
            if (bundle.watched.indexOf(path) === -1 && path !== bundle.entrypoint) {
                bundle.watched.push(path);
            }
        };

        bundles.forEach(function (bundle) {
            bundle.watcher.close();
        });

        tree.nodes.forEach(function (node, index) {
            var bundle = bundles[index] = {
                entrypoint: path.join(node.base, node.name),
                outputNode: undefined,
                watcher: bygglib.watcher(),
                cache: bundles[index] !== undefined ? bundles[index].cache : {},
                watched: []
            };

            bundle.watcher.listen(function (paths) {
                paths.forEach(function (path) {
                    delete bundle.cache[path];
                });
                render(bundle, node);
            });

            render(bundle, node);
        });

        return output;
    };
};
