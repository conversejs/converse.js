const { merge } = require('webpack-merge');
const buildConfig = require('../rspack/rspack.build.js');

module.exports = (env, argv) =>
    merge(buildConfig(env, argv), {
        output: {
            filename: '[name].js',
            chunkFilename: 'chunkjs.cjs/[name].js',
        },
    });
