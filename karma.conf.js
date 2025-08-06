/* global module */
const path = require('path');

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',
    frameworks: ['jasmine'],
    files: [
      { pattern: 'dist/*.js.map', included: false },
      { pattern: 'dist/*.css.map', included: false },
      {
        pattern: "dist/emoji.json",
        watched: false,
        included: false,
        served: true,
        type: 'json'
      },
      "src/shared/tests/tests.css",
      "dist/converse.js",
      "dist/converse.css",
      { pattern: "dist/images/**/*.*", included: false },
      { pattern: "dist/webfonts/**/*.*", included: false },
      { pattern: "logo/conversejs-filled.svg",
        watched: false,
        included: false,
        served: true,
        nocache: false
      },
      { pattern: "logo/conversejs-filled-192.svg",
        watched: false,
        included: false,
        served: true,
        nocache: false
      },
      { pattern: "logo/conversejs-filled-192.png",
        watched: false,
        included: false,
        served: true,
        nocache: false
      },
      { pattern: "src/shared/tests/mock.js", type: 'module' },
      { pattern: "src/headless/tests/mock.js", type: 'module' },

      // Ideally this should go into the headless test runner
      { pattern: "src/headless/plugins/vcard/tests/update.js", type: 'module' },

      { pattern: "src/i18n/tests/i18n.js", type: 'module' },
      { pattern: "src/plugins/adhoc-views/tests/*.js", type: 'module' },
      { pattern: "src/plugins/bookmark-views/tests/*.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/*.js", type: 'module' },
      { pattern: "src/plugins/controlbox/tests/*.js", type: 'module' },
      { pattern: "src/plugins/disco-views/tests/*.js", type: 'module' },
      { pattern: "src/plugins/headlines-view/tests/*.js", type: 'module' },
      { pattern: "src/plugins/mam-views/tests/*.js", type: 'module' },
      { pattern: "src/plugins/minimize/tests/*.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/*.js", type: 'module' },
      { pattern: "src/plugins/notifications/tests/*.js", type: 'module' },
      { pattern: "src/plugins/omemo/tests/*.js", type: 'module' },
      { pattern: "src/plugins/profile/tests/*.js", type: 'module' },
      { pattern: "src/plugins/push/tests/*.js", type: 'module' },
      { pattern: "src/plugins/register/tests/*.js", type: 'module' },
      { pattern: "src/plugins/roomslist/tests/*.js", type: 'module' },
      { pattern: "src/plugins/rootview/tests/*.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/*.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/requesting_contacts.js", type: 'module' },
      { pattern: "src/shared/modals/tests/*.js", type: 'module' },
      { pattern: "src/utils/tests/*.js", type: 'module' },
    ],

    proxies: {
      "/dist/emoji.json": "/base/dist/emoji.json",
      "/dist/images/custom_emojis/": "/base/dist/images/custom_emojis/",
      "/images/logo/": "/base/dist/images/logo/"
    },

    client: {
      jasmine: {
        random: false
      }
    },

    exclude: ['**/*.sw?'],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {},

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress', 'kjhtml'],

    webpack: {
      mode: 'development',
      devtool: 'inline-source-map',
      module: {
         rules: [{
           test: /\.js$/,
           exclude: /(node_modules|test)/
         }]
      },
      output: {
        path: path.resolve('test'),
        filename: '[name].out.js',
        chunkFilename: '[id].[chunkHash].js'
      }
    },


    port: 9876,
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Chrome'],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity
  })
}
