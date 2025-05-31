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
      { pattern: "dist/emojis.js", served: true },
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

      { pattern: "src/headless/plugins/blocklist/tests/blocklist.js", type: 'module' },
      { pattern: "src/headless/plugins/bookmarks/tests/bookmarks.js", type: 'module' },
      { pattern: "src/headless/plugins/bookmarks/tests/deprecated.js", type: 'module' },
      { pattern: "src/headless/plugins/caps/tests/caps.js", type: 'module' },
      { pattern: "src/headless/plugins/chat/tests/api.js", type: 'module' },
      { pattern: "src/headless/plugins/chat/tests/chat.js", type: 'module' },
      { pattern: "src/headless/plugins/disco/tests/disco.js", type: 'module' },
      { pattern: "src/headless/plugins/mam/tests/api.js", type: 'module' },
      { pattern: "src/headless/plugins/muc/tests/affiliations.js", type: 'module' },
      { pattern: "src/headless/plugins/muc/tests/messages.js", type: 'module' },
      { pattern: "src/headless/plugins/muc/tests/muc.js", type: 'module' },
      { pattern: "src/headless/plugins/muc/tests/occupants.js", type: 'module' },
      { pattern: "src/headless/plugins/muc/tests/pruning.js", type: 'module' },
      { pattern: "src/headless/plugins/muc/tests/registration.js", type: 'module' },
      { pattern: "src/headless/plugins/ping/tests/ping.js", type: 'module' },
      { pattern: "src/headless/plugins/pubsub/tests/config.js", type: 'module' },
      { pattern: "src/headless/plugins/roster/tests/presence.js", type: 'module' },
      { pattern: "src/headless/plugins/smacks/tests/smacks.js", type: 'module' },
      { pattern: "src/headless/plugins/status/tests/status.js", type: 'module' },
      { pattern: "src/headless/plugins/vcard/tests/update.js", type: 'module' },
      { pattern: "src/headless/shared/settings/tests/settings.js", type: 'module' },
      { pattern: "src/headless/tests/converse.js", type: 'module' },
      { pattern: "src/headless/tests/eventemitter.js", type: 'module' },
      { pattern: "src/plugins/adhoc-views/tests/adhoc.js", type: 'module' },
      { pattern: "src/plugins/bookmark-views/tests/bookmarks-list.js", type: 'module' },
      { pattern: "src/plugins/bookmark-views/tests/bookmarks.js", type: 'module' },
      { pattern: "src/plugins/bookmark-views/tests/deprecated.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/actions.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/chatbox.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/corrections.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/deprecated-retractions.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/emojis.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/http-file-upload.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/markers.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/me-messages.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/message-audio.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/message-avatar.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/message-form.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/message-gifs.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/message-images.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/message-videos.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/messages.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/oob.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/receipts.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/retractions.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/spoilers.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/styling.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/unreads.js", type: 'module' },
      { pattern: "src/plugins/chatview/tests/xss.js", type: 'module' },
      { pattern: "src/plugins/controlbox/tests/controlbox.js", type: 'module' },
      { pattern: "src/plugins/controlbox/tests/login.js", type: 'module' },
      { pattern: "src/plugins/disco-views/tests/disco-browser.js", type: 'module' },
      { pattern: "src/plugins/headlines-view/tests/headline.js", type: 'module' },
      { pattern: "src/plugins/mam-views/tests/mam.js", type: 'module' },
      { pattern: "src/plugins/mam-views/tests/placeholder.js", type: 'module' },
      { pattern: "src/plugins/minimize/tests/minchats.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/actions.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/autocomplete.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/commands.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/component.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/corrections.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/csn.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/deprecated-retractions.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/disco.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/drafts.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/emojis.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/hats.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/http-file-upload.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/info-messages.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/mam.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/markers.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/me-messages.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/member-lists.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/mentions.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/mep.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/modtools.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-add-modal.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-api.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-avatar.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-list-modal.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-mentions.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-messages.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-private-messages.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc-registration.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/muc.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/mute.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/nickname.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/occupants-filter.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/occupants.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/probes.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/rai.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/retractions.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/styling.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/unfurls.js", type: 'module' },
      { pattern: "src/plugins/muc-views/tests/xss.js", type: 'module' },
      { pattern: "src/plugins/notifications/tests/notification.js", type: 'module' },
      { pattern: "src/plugins/omemo/tests/corrections.js", type: 'module' },
      { pattern: "src/plugins/omemo/tests/media-sharing.js", type: 'module' },
      { pattern: "src/plugins/omemo/tests/muc.js", type: 'module' },
      { pattern: "src/plugins/omemo/tests/omemo.js", type: 'module' },
      { pattern: "src/plugins/profile/tests/password-reset.js", type: 'module' },
      { pattern: "src/plugins/profile/tests/profile.js", type: 'module' },
      { pattern: "src/plugins/profile/tests/status.js", type: 'module' },
      { pattern: "src/plugins/push/tests/push.js", type: 'module' },
      { pattern: "src/plugins/register/tests/register.js", type: 'module' },
      { pattern: "src/plugins/roomslist/tests/grouplists.js", type: 'module' },
      { pattern: "src/plugins/roomslist/tests/roomslist.js", type: 'module' },
      { pattern: "src/plugins/rootview/tests/root.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/add-contact-modal.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/blocklist.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/new-chat-modal.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/presence.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/protocol.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/blocklist.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/requesting_contacts.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/roster.js", type: 'module' },
      { pattern: "src/plugins/rosterview/tests/unsaved-contacts.js", type: 'module' },
      { pattern: "src/shared/modals/tests/user-details-modal.js", type: 'module' },
      { pattern: "src/utils/tests/url.js", type: 'module' },

      // For some reason this test causes issues when its run earlier
      { pattern: "src/headless/tests/persistence.js", type: 'module' },
    ],

    proxies: {
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
