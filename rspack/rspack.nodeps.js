import { rspack } from '@rspack/core';
import path from 'path';
import { merge } from 'webpack-merge';
import common from '../rspack/rspack.common.js';

export default merge(common, {
    mode: 'production',
    optimization: {
        minimize: false,
    },
    entry: {
        'converse-no-dependencies': path.resolve(__dirname, '../src/index.js'),
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
                // `/src/` also matches dependencies under `node_modules/*/src/`.
                // Keep downleveling those: xgettext stops extracting strings at
                // syntax it doesn't understand. mediabunny is excluded because
                // swc miscompiles its labeled loops to ES5, and it holds no
                // translatable strings.
                include: /src/,
                exclude: /mediabunny/,
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
                                quietDeps: true,
                                silenceDeprecations: ['color-functions', 'global-builtin', 'import'],
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
