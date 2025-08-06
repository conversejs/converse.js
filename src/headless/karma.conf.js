/* global module */
module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    files: [
      {
        pattern: "dist/emoji.json",
        watched: false,
        included: false,
        served: true,
        type: 'json'
      },
      { pattern: 'dist/*.js.map', included: false },
      "dist/converse-headless.js",
      { pattern: "tests/*.js", type: 'module' },
      { pattern: "shared/settings/tests/settings.js", type: 'module' },
      { pattern: "plugins/blocklist/tests/*.js", type: 'module' },
      { pattern: "plugins/caps/tests/*.js", type: 'module' },
      { pattern: "plugins/bookmarks/tests/*.js", type: 'module' },
      { pattern: "plugins/chat/tests/*.js", type: 'module' },
      { pattern: "plugins/disco/tests/*.js", type: 'module' },
      { pattern: "plugins/mam/tests/*.js", type: 'module' },
      { pattern: "plugins/muc/tests/*.js", type: 'module' },
      { pattern: "plugins/ping/tests/*.js", type: 'module' },
      { pattern: "plugins/pubsub/tests/*.js", type: 'module' },
      { pattern: "plugins/roster/tests/*.js", type: 'module' },
      { pattern: "plugins/smacks/tests/*.js", type: 'module' },
      { pattern: "plugins/status/tests/*.js", type: 'module' },
    ],
    client: {
      jasmine: {
        random: false
      }
    },
    exclude: ['**/*.sw?'],
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false,
    concurrency: Infinity
  })
}
