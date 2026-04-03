const { merge } = require('webpack-merge');
const buildConfig = require('../rspack/rspack.build.js');

module.exports = (env, argv) =>
    merge(buildConfig(env, argv), {
        experiments: {
            outputModule: true,
            topLevelAwait: true,
        },
        output: {
            filename: '[name].esm.js',
            chunkFilename: 'chunkjs.esm/[name].js',
            library: {
                type: 'module',
            },
        },
    });
