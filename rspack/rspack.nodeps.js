const { rspack } = require('@rspack/core');
const path = require('path');
const { merge } = require('webpack-merge');
const common = require('../rspack/rspack.common.js');

module.exports = merge(common, {
    mode: 'production',
    optimization: {
        minimize: false,
    },
    entry: {
        'converse-no-dependencies': path.resolve(__dirname, '../src/entry.js'),
    },
    plugins: [
        new rspack.CssExtractRspackPlugin({ filename: 'tmp.css' }),
        new rspack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production'),
        }),
    ],
    module: {
        rules: [
            {
                test: /\.js$/,
                include: /src/,
                use: {
                    loader: 'builtin:swc-loader',
                    options: {
                        jsc: {
                            target: 'es5',
                            preserveAllComments: true,
                            parser: {
                                syntax: 'ecmascript',
                                dynamicImport: false,
                                decorators: false,
                            },
                        },
                    },
                },
            },
            {
                test: /\.scss$/,
                use: [
                    rspack.CssExtractRspackPlugin.loader,
                    'css-loader',
                    {
                        loader: 'sass-loader',
                        options: {
                            api: 'modern-compiler',
                            sassOptions: {
                                silenceDeprecations: ['color-functions', 'global-builtin', 'import', 'mixed-decls'],
                                includePaths: [path.resolve(__dirname, '../node_modules/')],
                            },
                        },
                    },
                ],
            },
        ],
    },
    externals: [
        {
            '@converse/skeletor': 'skeletor',
            'filesize': 'filesize',
            'jed': 'jed',
            'lit': 'lit',
            'lit-html': 'lit-html',
            'localforage': 'localforage',
            'lodash': 'lodash',
            'lodash.noconflict': 'lodash.noconflict',
            'pluggable.js': 'pluggable',
            'sizzle': 'sizzle',
            'strophe.js': 'strophe',
            'urijs': 'urijs',
            'window': 'window',
        },
    ],
});
