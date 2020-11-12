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
      { pattern: "dist/icons.js", served: true },
      { pattern: "dist/emojis.js", served: true },
      "dist/converse.js",
      "dist/converse.css",
      { pattern: "dist/images/**/*.*", included: false },
      { pattern: "dist/webfonts/**/*.*", included: false },
      { pattern: "dist/\@fortawesome/fontawesome-free/sprites/solid.svg",
        watched: false,
        included: false,
        served: true,
        nocache: false
      },
      { pattern: "node_modules/sinon/pkg/sinon.js", type: 'module' },
      { pattern: "spec/mock.js", type: 'module' },

      { pattern: "spec/spoilers.js", type: 'module' },
      { pattern: "spec/emojis.js", type: 'module' },
      { pattern: "spec/muclist.js", type: 'module' },
      { pattern: "spec/utils.js", type: 'module' },
      { pattern: "spec/converse.js", type: 'module' },
      { pattern: "spec/bookmarks.js", type: 'module' },
      { pattern: "spec/headline.js", type: 'module' },
      { pattern: "spec/disco.js", type: 'module' },
      { pattern: "spec/protocol.js", type: 'module' },
      { pattern: "spec/presence.js", type: 'module' },
      { pattern: "spec/eventemitter.js", type: 'module' },
      { pattern: "spec/smacks.js", type: 'module' },
      { pattern: "spec/ping.js", type: 'module' },
      { pattern: "spec/push.js", type: 'module' },
      { pattern: "spec/xmppstatus.js", type: 'module' },
      { pattern: "spec/mam.js", type: 'module' },
      { pattern: "spec/omemo.js", type: 'module' },
      { pattern: "spec/controlbox.js", type: 'module' },
      { pattern: "spec/roster.js", type: 'module' },
      { pattern: "spec/chatbox.js", type: 'module' },
      { pattern: "spec/user-details-modal.js", type: 'module' },
      { pattern: "spec/messages.js", type: 'module' },
      { pattern: "spec/corrections.js", type: 'module' },
      { pattern: "spec/receipts.js", type: 'module' },
      { pattern: "spec/muc_messages.js", type: 'module' },
      { pattern: "spec/mentions.js", type: 'module' },
      { pattern: "spec/retractions.js", type: 'module' },
      { pattern: "spec/muc.js", type: 'module' },
      { pattern: "spec/modtools.js", type: 'module' },
      { pattern: "spec/room_registration.js", type: 'module' },
      { pattern: "spec/autocomplete.js", type: 'module' },
      { pattern: "spec/minchats.js", type: 'module' },
      { pattern: "spec/notification.js", type: 'module' },
      { pattern: "spec/login.js", type: 'module' },
      { pattern: "spec/register.js", type: 'module' },
      { pattern: "spec/hats.js", type: 'module' },
      { pattern: "spec/http-file-upload.js", type: 'module' },
      { pattern: "spec/xss.js", type: 'module' }
    ],

    proxies: {
      "/dist/images/custom_emojis/": "/base/dist/images/custom_emojis/"
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
