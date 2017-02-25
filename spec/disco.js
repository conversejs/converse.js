(function (root, factory) {
    define([
        "jquery",
        "converse-core",
        "mock",
        "test_utils"], factory);
} (this, function ($, converse, mock, test_utils) {
    "use strict";
    var Strophe = converse.env.Strophe;

    describe("Service Discovery", function () {
        describe("Whenever converse.js discovers a new server feature", function () {
           it("emits the serviceDiscovered event", mock.initConverse(function (_converse) {
                spyOn(_converse, 'emit');
                _converse.features.create({'var': Strophe.NS.MAM});
                expect(_converse.emit).toHaveBeenCalled();
                expect(_converse.emit.argsForCall[0][1].get('var')).toBe(Strophe.NS.MAM);
            }));
        });
    });
}));
