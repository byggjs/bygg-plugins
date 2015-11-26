'use strict';

var postcss = require('../postcss');
var autoprefixer = require('autoprefixer');

var DEFAULT_CONSTRAINTS = ['last 2 versions', 'ie 9'];

module.exports = function () {
    var constraints = arguments.length > 0 ? Array.prototype.slice.call(arguments) : DEFAULT_CONSTRAINTS;
    return postcss([autoprefixer({ browsers: constraints })], 'autoprefixer');
};
