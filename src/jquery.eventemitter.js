(function (root, factory) {
    if (typeof console === "undefined" || typeof console.log === "undefined") {
        console = { log: function () {}, error: function () {} };
    }
    if (typeof define === 'function' && define.amd) {
        define("converse", ["jquery"], function($) {
            return factory($);
        });
    } else {
        factory($);
    }
}(this, function ($) {
    $.eventEmitter = {
        emit: function(evt, data) {
            $(this).trigger(evt, data);
        },
        once: function(evt, handler) {
            $(this).one(evt, handler);
        },
        on: function(evt, handler) {
            $(this).bind(evt, handler);
        },
        off: function(evt, handler) {
            $(this).unbind(evt, handler);
        }
    };
}));
