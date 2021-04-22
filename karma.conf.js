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
      "node_modules/lodash/lodash.min.js",
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

      { pattern: "spec/converse.js", type: 'module' },
      { pattern: "spec/corrections.js", type: 'module' },
      { pattern: "spec/emojis.js", type: 'module' },
      { pattern: "spec/eventemitter.js", type: 'module' },
      { pattern: "spec/http-file-upload.js", type: 'module' },
      { pattern: "spec/markers.js", type: 'module' },
      { pattern: "spec/presence.js", type: 'module' },
      { pattern: "spec/protocol.js", type: 'module' },
      { pattern: "spec/push.js", type: 'module' },
      { pattern: "spec/retractions.js", type: 'module' },
      { pattern: "spec/smacks.js", type: 'module' },
      { pattern: "spec/styling.js", type: 'module' },
      { pattern: "spec/unfurls.js", type: 'module' },
      { pattern: "spec/user-details-modal.js", type: 'module' },
      { pattern: "spec/utils.js", type: 'module' },
      { pattern: "spec/xmppstatus.js", type: 'module' },
      { pattern: "src/headless/plugins/chat/tests/api.js", type: 'module' },
      { pattern: "src/headless/plugins/disco/tests/disco.js", type: 'module' },
      { pattern: "src/headless/plugins/muc/tests/affiliations.js", type: 'module' },
      { pattern: "src/headless/plugins/ping/tests/ping.js", type: 'module' },
      { pattern: "src/plugins/bookmark-views/tests/bookmarks.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/chatbox.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/corrections.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/me-messages.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/message-images.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/messages.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/receipts.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/spoilers.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/xss.js", type: 'module' },
      { pattern: "src/plugins/controlbox/tests/controlbox.js", type: 'module' },
      { pattern: "src/plugins/controlbox/tests/login.js", type: 'module' },
      { pattern: "src/plugins/headlines-view/tests/headline.js", type: 'module' },
      { pattern: "src/plugins/mam-views/tests/mam.js", type: 'module' },
      { pattern: "src/plugins/minimize/tests/minchats.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/autocomplete.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/corrections.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/hats.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/mentions.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/modtools.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-api.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-mentions.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-messages.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-registration.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muclist.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/rai.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/styling.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/xss.js", type: 'module' },
      { pattern: "src/plugins/notifications/tests/notification.js", type: 'module' },
      { pattern: "src/plugins/omemo/tests/omemo.js", type: 'module' },
      { pattern: "src/plugins/register/tests/register.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/roster.js", type: 'module' }
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
