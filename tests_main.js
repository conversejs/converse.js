require(["jquery", "converse", "mock", "spec/MainSpec", "spec/ChatRoomSpec"], function($, converse, mock_connection) {
    // Set up converse.js
    window.localStorage.clear();
    converse.initialize({
        prebind: false,
        xhr_user_search: false,
        auto_subscribe: false,
        animate: false
    });
    converse.onConnected(mock_connection);

    // Jasmine stuff
    var jasmineEnv = jasmine.getEnv();
    jasmineEnv.updateInterval = 250;
    var htmlReporter = new jasmine.HtmlReporter();
    jasmineEnv.addReporter(htmlReporter);
    jasmineEnv.specFilter = function(spec) {
        return htmlReporter.specFilter(spec);
    };
    jasmineEnv.execute();
});
