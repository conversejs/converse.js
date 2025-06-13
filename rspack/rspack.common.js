const { rspack } = require('@rspack/core');
const path = require('path');

module.exports = {
    plugins: [
        new rspack.DefinePlugin({
            'process.env.ASSET_PATH': JSON.stringify(process.env.ASSET_PATH || '/dist/'),
        }),
        new rspack.CircularDependencyRspackPlugin({
            exclude: /node_modules/,
            failOnError: true,
            allowAsyncCycles: false,
            cwd: process.cwd(),
        }),
    ],
    output: {
        path: path.resolve(__dirname, '../dist'),
        publicPath: process.env.ASSET_PATH || '/dist/',
        chunkFilename: '[name].js',
    },
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /LC_MESSAGES[\\/]converse.po$/,
                type: 'json',
                use: [
                    {
                        loader: 'po-loader',
                        options: {
                            'format': 'jed',
                            'domain': 'converse',
                        },
                    },
                ],
            },
            {
                test: /webfonts[\\/].*\.(woff(2)?|ttf|eot|truetype|svg)(\?v=\d+\.\d+\.\d+)?$/,
                type: 'asset/resource',
                generator: {
                    filename: '[name][ext]',
                    publicPath: 'webfonts/',
                    outputPath: 'webfonts/',
                },
            },
            {
                test: /\.scss$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            url: false,
                            sourceMap: true,
                        },
                    },
                    {
                        loader: 'postcss-loader',
                        options: { sourceMap: true },
                    },
                    {
                        loader: 'sass-loader',
                        options: {
                            sassOptions: {
                                silenceDeprecations: ['color-functions', 'global-builtin', 'import', 'mixed-decls'],
                                includePaths: [
                                    path.resolve(__dirname, '../node_modules/'),
                                    path.resolve(__dirname, '../src/'),
                                ],
                            },
                            sourceMap: true,
                        },
                    },
                ],
            },
        ],
    },
    resolve: {
        extensions: ['.js'],
        modules: ['node_modules', path.resolve(__dirname, '../src')],
        alias: {
            'IPv6': path.resolve(__dirname, '../node_modules/urijs/src/IPv6'),
            'SecondLevelDomains': path.resolve(__dirname, '../node_modules/urijs/src/SecondLevelDomains'),
            'punycode': path.resolve(__dirname, '../node_modules/urijs/src/punycode'),
        },
    },
    watchOptions: {
        ignored: [
            path.posix.resolve(__dirname, '../node_modules'),
            path.posix.resolve(__dirname, '../3rdparty'),
            path.posix.resolve(__dirname, '../dist'),
        ],
    },
};
