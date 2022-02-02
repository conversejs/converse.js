/* global __dirname, module, process */
const path = require('path');

let bootstrap_ignore_modules = ['carousel', 'scrollspy', 'tooltip', 'toast'];


const BOOTSTRAP_IGNORE_MODULES = (process.env.BOOTSTRAP_IGNORE_MODULES || '').replace(/ /g, '').trim();
if (BOOTSTRAP_IGNORE_MODULES.length > 0) {
    bootstrap_ignore_modules = bootstrap_ignore_modules.concat(BOOTSTRAP_IGNORE_MODULES.split(','));
}

module.exports = {
    output: {
        path: path.resolve(__dirname, '../dist'), // Output path for generated bundles
        chunkFilename: '[name].js'
    },
    entry: path.resolve(__dirname, '../src/entry.js'),
    externals: [{
        "window": "window"
    }],
    watchOptions: {
        ignored: /dist/,
    },
    module: {
        rules: [
        {
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
            use: [
            {
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]',
                    outputPath: 'webfonts/'
                }
            }
            ]
        }, {
            test: /\.scss$/,
            use: [
                'style-loader',
                {
                    loader: 'css-loader',
                    options: {
                        sourceMap: true
                    }
                },
                'postcss-loader',
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
                }
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
                loader: 'babel-loader',
                options: {
                    presets: [
                        ["@babel/preset-env", {
                            "targets": {
                                "browsers": [">1%", "not ie 11", "not op_mini all", "not dead"]
                            }
                        }]
                    ],
                    plugins: []
                }
            }
        }, {
            test: /bootstrap\.native/,
            use: {
                loader: 'bootstrap.native-loader',
                options: {
                    bs_version: 4,
                    ignore: bootstrap_ignore_modules
                }
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
            "formdata-polyfill":        path.resolve(__dirname, "../node_modules/formdata-polyfill/FormData"),
            "punycode":                 path.resolve(__dirname, "../node_modules/urijs/src/punycode")
        }
    }
}
