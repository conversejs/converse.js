(function (root, factory) {
    define([
        "mock",
        "utils"
        ], function (mock, utils) {
            return factory(mock, utils);
        }
    );
} (this, function (mock, utils) {
    return describe("The Converse Event Emitter", $.proxy(function(mock, utils) {
        window.localStorage.clear();
        window.sessionStorage.clear();

        it("allows you to subscribe to emitted events", function () {
            this.callback = function () {};
            spyOn(this, 'callback');
            converse.on('initialized', this.callback);
            converse.emit('initialized');
            expect(this.callback).toHaveBeenCalled();
            converse.emit('initialized');
            expect(this.callback.callCount, 2);
            converse.emit('initialized');
            expect(this.callback.callCount, 3);
        });

        it("allows you to listen once for an emitted event", function () {
            this.callback = function () {};
            spyOn(this, 'callback');
            converse.once('initialized', this.callback);
            converse.emit('initialized');
            expect(this.callback).toHaveBeenCalled();
            converse.emit('initialized');
            expect(this.callback.callCount, 1);
            converse.emit('initialized');
            expect(this.callback.callCount, 1);
        });

        it("allows you to stop listening or subscribing to an event", function () {
            this.callback = function () {};
            this.anotherCallback = function () {};
            this.neverCalled = function () {};

            spyOn(this, 'callback');
            spyOn(this, 'anotherCallback');
            spyOn(this, 'neverCalled');
            converse.on('initialized', this.callback);
            converse.on('initialized', this.anotherCallback);

            converse.emit('initialized');
            expect(this.callback).toHaveBeenCalled();
            expect(this.anotherCallback).toHaveBeenCalled();

            converse.off('initialized', this.callback);

            converse.emit('initialized');
            expect(this.callback.callCount, 1);
            expect(this.anotherCallback.callCount, 2);

            converse.once('initialized', this.neverCalled);
            converse.off('initialized', this.neverCalled);

            converse.emit('initialized');
            expect(this.callback.callCount, 1);
            expect(this.anotherCallback.callCount, 3);
            expect(this.neverCalled).not.toHaveBeenCalled();
        });
    }, converse, mock, utils));
}));
