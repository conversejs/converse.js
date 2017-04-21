/*global document, require, setInterval, clearInterval, eval, phantom, console */

var system = require('system');

function waitFor(testFx, onReady, timeOutMillis) {
    /**
     * Wait until the test condition is true or a timeout occurs. Useful for waiting
     * on a server response or for a ui change (fadeIn, etc.) to occur.
     *
     * @param testFx javascript condition that evaluates to a boolean,
     * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
     * as a callback function.
     * @param onReady what to do when testFx condition is fulfilled,
     * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
     * as a callback function.
     * @param timeOutMillis the max amount of time to wait. If not specified, 3 sec is used.
     */
    "use strict";
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 40001, //< Default Max Timeout is 10s
        start = new Date().getTime(),
        condition = false,
        interval = setInterval(function() {
            if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
                // If not time-out yet and condition not yet fulfilled
                condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); // eslint-disable-line no-eval
            } else {
                if(!condition) {
                    // If condition still not fulfilled (timeout but condition is 'false')
                    console.log("'waitFor()' timeout");
                    phantom.exit(1);
                } else {
                    // Condition fulfilled (timeout and/or condition is 'true')
                    console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
                    // Do what it's supposed to do once the condition is fulfilled
                    typeof(onReady) === "string" ? eval(onReady) : onReady(); // eslint-disable-line no-eval
                    clearInterval(interval); //< Stop this interval
                }
            }
        }, 100); //< repeat check every 100ms
}

if (system.args.length !== 2) {
    console.log('Usage: run-jasmine2.js URL');
    phantom.exit(1);
}

var page = require('webpage').create();

page.onConsoleMessage = function(msg) {
    // Route "console.log()" calls from within the Page context to the main
    // Phantom context (i.e. current "this")
    console.log(msg);
};

page.open(system.args[1], function(status){
    "use strict";
    if (status !== "success") {
        console.log("Unable to access network");
        phantom.exit();
    } else {
        waitFor(function(){
            return page.evaluate(function(){
                return (document.body.querySelector('.jasmine-symbol-summary .pending') === null &&
                        document.body.querySelector('.jasmine-duration') !== null);
            });
        }, function(){
            var exitCode = page.evaluate(function(){
                console.log('');
                var title = 'Jasmine';
                var version = document.body.querySelector('.jasmine-version').innerText;
                var duration = document.body.querySelector('.jasmine-duration').innerText;
                var banner = title + ' ' + version + ' ' + duration;
                console.log(banner);

                var list = document.body.querySelectorAll('.jasmine-results > .jasmine-failures > .jasmine-spec-detail.jasmine-failed');
                if (list && list.length > 0) {
                    console.log('');
                    console.log(list.length + ' test(s) FAILED:');
                    for (var i = 0; i < list.length; ++i) {
                        var el = list[i],
                            desc = el.querySelector('.jasmine-description'),
                            msg = el.querySelector('.jasmine-messages > .jasmine-result-message');
                        console.log('');
                        console.log(desc.innerText);
                        console.log(msg.innerText);
                        console.log('');
                    }
                    return 1;
                } else {
                    console.log(document.body.querySelector('.jasmine-alert > .jasmine-bar.jasmine-passed, .jasmine-alert > .jasmine-bar.skipped').innerText);
                    return 0;
                }
            });
            phantom.exit(exitCode);
        });
    }
});
