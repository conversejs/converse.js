(function (root, factory) {
    define(["mock", "converse-api", "test_utils"], factory);
} (this, function (mock, converse_api, test_utils) {

    return describe("The Converse Event Emitter", function() {

        it("allows you to subscribe to emitted events", mock.initConverse(function (converse) {
            this.callback = function () {};
            spyOn(this, 'callback');
            converse.on('connected', this.callback);
            converse.emit('connected');
            expect(this.callback).toHaveBeenCalled();
            converse.emit('connected');
            expect(this.callback.callCount, 2);
            converse.emit('connected');
            expect(this.callback.callCount, 3);
        }));

        it("allows you to listen once for an emitted event", mock.initConverse(function (converse) {
            this.callback = function () {};
            spyOn(this, 'callback');
            converse.once('connected', this.callback);
            converse.emit('connected');
            expect(this.callback).toHaveBeenCalled();
            converse.emit('connected');
            expect(this.callback.callCount, 1);
            converse.emit('connected');
            expect(this.callback.callCount, 1);
        }));

        it("allows you to stop listening or subscribing to an event", mock.initConverse(function (converse) {
            this.callback = function () {};
            this.anotherCallback = function () {};
            this.neverCalled = function () {};

            spyOn(this, 'callback');
            spyOn(this, 'anotherCallback');
            spyOn(this, 'neverCalled');
            converse.on('connected', this.callback);
            converse.on('connected', this.anotherCallback);

            converse.emit('connected');
            expect(this.callback).toHaveBeenCalled();
            expect(this.anotherCallback).toHaveBeenCalled();

            converse.off('connected', this.callback);

            converse.emit('connected');
            expect(this.callback.callCount, 1);
            expect(this.anotherCallback.callCount, 2);

            converse.once('connected', this.neverCalled);
            converse.off('connected', this.neverCalled);

            converse.emit('connected');
            expect(this.callback.callCount, 1);
            expect(this.anotherCallback.callCount, 3);
            expect(this.neverCalled).not.toHaveBeenCalled();
        }));
    });
}));
