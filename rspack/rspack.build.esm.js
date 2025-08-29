const { merge } = require('webpack-merge');
const common = require('../rspack/rspack.build.js');

module.exports = merge(common, {
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
