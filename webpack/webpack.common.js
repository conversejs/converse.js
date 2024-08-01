/* global __dirname, module, process */
const ASSET_PATH = process.env.ASSET_PATH || '/dist/'; // eslint-disable-line no-process-env
const webpack = require('webpack');
const TerserPlugin = require("terser-webpack-plugin");
const path = require('path');

const plugins = [
    new webpack.DefinePlugin({ // This makes it possible for us to safely use env vars on our code
        'process.env.ASSET_PATH': JSON.stringify(ASSET_PATH)
    }),
];

module.exports = {
    plugins,
    output: {
        path: path.resolve(__dirname, '../dist'), // Output path for generated bundles
        publicPath: ASSET_PATH,
        chunkFilename: '[name].js'
    },
    devtool: "source-map",
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                include: /\.min\.js$/
            })
        ],
    },
    externals: [{
        "window": "window"
    }],
    watchOptions: {
        ignored: /dist/,
    },
    module: {
        rules: [{
            test: /LC_MESSAGES[\\/]converse.po$/,
            type: "json",
            use: [
            {
                loader: 'po-loader',
                options: {
                    'format': 'jed',
                    'domain': 'converse'
                }
            }
            ]
        }, {
            test: /webfonts[\\/].*\.(woff(2)?|ttf|eot|truetype|svg)(\?v=\d+\.\d+\.\d+)?$/,
            type: 'asset/resource',
            generator: {
                filename: '[name][ext]',
                publicPath: 'webfonts/',
                outputPath: 'webfonts/'
            }
        }, {
            test: /\.scss$/,
            use: [
                'style-loader',
                {
                    loader: 'css-loader',
                    options: {
                        url: false,
                        sourceMap: true

                    }
                },
                {
                    loader: "postcss-loader",
                    options: { sourceMap: true }
                },
                {
                    loader: 'sass-loader',
                    options: {
                        sassOptions: {
                            includePaths: [
                                path.resolve(__dirname, '../node_modules/'),
                                path.resolve(__dirname, '../src/')
                            ]
                        },
                        sourceMap: true
                    }
                },
            ]
        }, {
            test: /\.js$/,
            include: [
                /src/,
                /node_modules\/mergebounce/,
                /node_modules\/lit-html/,
                /node_modules\/strophe/,
                /node_modules\/pluggable/,
                /node_modules\/@converse/,
            ],
            use: {
                loader: 'babel-loader'
            }
        }],
    },
    resolve: {
        extensions: ['.js'],
        modules: [
            'node_modules',
            path.resolve(__dirname, "../src")
        ],
        alias: {
            "IPv6":                     path.resolve(__dirname, "../node_modules/urijs/src/IPv6"),
            "SecondLevelDomains":       path.resolve(__dirname, "../node_modules/urijs/src/SecondLevelDomains"),
            "punycode":                 path.resolve(__dirname, "../node_modules/urijs/src/punycode"),
            "./shims.js":               path.resolve(__dirname, "../src/strophe-shims.js"),
            "./shims":                  path.resolve(__dirname, "../src/strophe-shims.js"),
        }
    }

}
