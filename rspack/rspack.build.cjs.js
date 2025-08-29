const { merge } = require('webpack-merge');
const common = require('../rspack/rspack.build.js');

module.exports = merge(common, {
    output: {
        filename: '[name].js',
        chunkFilename: 'chunkjs.cjs/[name].js',
    },
});
