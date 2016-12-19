(function (root, factory) {
    define([
        "jquery",
        "converse-api",
        "mock",
        "test_utils"], factory);
} (this, function ($, converse_api, mock, test_utils) {
    "use strict";
    var Strophe = converse_api.env.Strophe;

    describe("Service Discovery", function () {

        describe("Whenever converse.js discovers a new server feature", function () {

           it("emits the serviceDiscovered event", mock.initConverse(function (converse) {
                spyOn(converse, 'emit');
                converse.features.create({'var': Strophe.NS.MAM});
                expect(converse.emit).toHaveBeenCalled();
                expect(converse.emit.argsForCall[0][1].get('var')).toBe(Strophe.NS.MAM);
            }));
        });
    });
}));
