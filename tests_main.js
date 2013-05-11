require(["jquery", "spec/MainSpec"], function($) {

    $(function($) {
        var jasmineEnv = jasmine.getEnv();
        jasmineEnv.updateInterval = 250;

        var htmlReporter = new jasmine.HtmlReporter();

        jasmineEnv.addReporter(htmlReporter);

        jasmineEnv.specFilter = function(spec) {
            return htmlReporter.specFilter(spec);
        };
        jasmineEnv.execute();
    });
});
