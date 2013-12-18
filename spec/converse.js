(function (root, factory) {
    define([
        "mock",
        "utils"
        ], function (mock, utils) {
            return factory(mock, utils);
        }
    );
} (this, function (mock, utils) {
    return describe("Converse", $.proxy(function(mock, utils) {
        window.localStorage.clear();

        it("allows you to subscribe to emitted events", function () {
            this.callback = function () {};
            spyOn(this, 'callback');
            converse.on('onInitialized', this.callback);
            converse.emit('onInitialized');
            expect(this.callback).toHaveBeenCalled();
            converse.emit('onInitialized');
            expect(this.callback.callCount, 2);
            converse.emit('onInitialized');
            expect(this.callback.callCount, 3);
        });

        it("allows you to listen once for an emitted event", function () {
            this.callback = function () {};
            spyOn(this, 'callback');
            converse.once('onInitialized', this.callback);
            converse.emit('onInitialized');
            expect(this.callback).toHaveBeenCalled();
            converse.emit('onInitialized');
            expect(this.callback.callCount, 1);
            converse.emit('onInitialized');
            expect(this.callback.callCount, 1);
        });

        it("allows you to stop listening or subscribing to an event", function () {
            this.callback = function () {};
            this.anotherCallback = function () {};
            this.neverCalled = function () {};

            spyOn(this, 'callback');
            spyOn(this, 'anotherCallback');
            spyOn(this, 'neverCalled');
            converse.on('onInitialized', this.callback);
            converse.on('onInitialized', this.anotherCallback);

            converse.emit('onInitialized');
            expect(this.callback).toHaveBeenCalled();
            expect(this.anotherCallback).toHaveBeenCalled();

            converse.off('onInitialized', this.callback);

            converse.emit('onInitialized');
            expect(this.callback.callCount, 1);
            expect(this.anotherCallback.callCount, 2);

            converse.once('onInitialized', this.neverCalled);
            converse.off('onInitialized', this.neverCalled);

            converse.emit('onInitialized');
            expect(this.callback.callCount, 1);
            expect(this.anotherCallback.callCount, 3);
            expect(this.neverCalled).not.toHaveBeenCalled();
        });
    }, converse, mock, utils));
}));
