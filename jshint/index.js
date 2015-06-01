'use strict';

var bygglib = require('bygg/lib');
var jshint = require('jshint').JSHINT;
var jshintCli = require('jshint/src/cli');
var jshintStylish = require('jshint-stylish');
var extend = require('extend');
var minimatch = require('minimatch');
var path = require('path');
var RcLoader = require('rcloader');

module.exports = function (options) {
    options = options || {};

    var rcLoader = new RcLoader('.jshintrc', options, {
        loader: function (path) {
            var config = jshintCli.loadConfig(path);
            delete config.dirname;
            return config;
        }
    });

    return function (tree) {
        var result = [];
        var remaining = tree.nodes.length;

        tree.nodes.forEach(function (node) {
            var filePath = path.join(node.base, node.name);
            rcLoader.for(filePath, function (err, config) {
                if (!err) {
                    var globals = {};

                    if (config.globals) {
                        globals = config.globals;
                        delete config.globals;
                    }

                    if (config.overrides) {
                        Object.keys(config.overrides).forEach(function (pattern) {
                            if (minimatch(filePath, pattern, { matchBase: true, nocase: true })) {
                                var options = config.overrides[pattern];

                                if (options.globals) {
                                    extend(globals, options.globals);
                                    delete options.globals;
                                }

                                extend(config, options);
                            }
                        });
                        delete config.overrides;
                    }

                    var success = jshint(node.data.toString('utf8'), config, globals);
                    if (!success) {
                        Array.prototype.push.apply(result, jshint.errors.filter(function (err) {
                            return err !== null;
                        }).map(function (err) {
                            return {
                                file: node.name,
                                error: err
                            };
                        }));
                    }
                } else {
                    console.log(err);
                }

                if (--remaining === 0) {
                    bygglib.logger.log('jshint', '');
                    jshintStylish.reporter(result, {});
                }
            });
        });

        return bygglib.signal.constant(tree);
    };
};
