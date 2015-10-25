/*global converse */
(function (root, factory) {
    define([
        "jquery",
        "mock",
        "test_utils"
        ], function ($, mock, test_utils) {
            return factory($, mock, test_utils);
        }
    );
} (this, function ($, mock, test_utils) {
    "use strict";
    var Strophe = converse_api.env.Strophe;

    describe("Service Discovery", $.proxy(function (mock, test_utils) {

        describe("Whenever converse.js discovers a new server feature", $.proxy(function (mock, test_utils) {
           it("emits the serviceDiscovered event", function () {
                spyOn(converse, 'emit');
                converse.features.create({'var': Strophe.NS.MAM});
                expect(converse.emit).toHaveBeenCalled();
                expect(converse.emit.argsForCall[0][1].get('var')).toBe(Strophe.NS.MAM);
            });
        }, converse, mock, test_utils));
    }, converse, mock, test_utils));
}));
