(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {

    return describe("The _converse Event Emitter", function() {

        it("allows you to subscribe to emitted events", mock.initConverse((done, _converse) => {
            this.callback = function () {};
            spyOn(this, 'callback');
            _converse.on('connected', this.callback);
            _converse.api.trigger('connected');
            expect(this.callback).toHaveBeenCalled();
            _converse.api.trigger('connected');
            expect(this.callback.calls.count(), 2);
            _converse.api.trigger('connected');
            expect(this.callback.calls.count(), 3);
            done();
        }));

        it("allows you to listen once for an emitted event", mock.initConverse((done, _converse) => {
            this.callback = function () {};
            spyOn(this, 'callback');
            _converse.once('connected', this.callback);
            _converse.api.trigger('connected');
            expect(this.callback).toHaveBeenCalled();
            _converse.api.trigger('connected');
            expect(this.callback.calls.count(), 1);
            _converse.api.trigger('connected');
            expect(this.callback.calls.count(), 1);
            done();
        }));

        it("allows you to stop listening or subscribing to an event", mock.initConverse((done, _converse) => {
            this.callback = function () {};
            this.anotherCallback = function () {};
            this.neverCalled = function () {};

            spyOn(this, 'callback');
            spyOn(this, 'anotherCallback');
            spyOn(this, 'neverCalled');
            _converse.on('connected', this.callback);
            _converse.on('connected', this.anotherCallback);

            _converse.api.trigger('connected');
            expect(this.callback).toHaveBeenCalled();
            expect(this.anotherCallback).toHaveBeenCalled();

            _converse.off('connected', this.callback);

            _converse.api.trigger('connected');
            expect(this.callback.calls.count(), 1);
            expect(this.anotherCallback.calls.count(), 2);

            _converse.once('connected', this.neverCalled);
            _converse.off('connected', this.neverCalled);

            _converse.api.trigger('connected');
            expect(this.callback.calls.count(), 1);
            expect(this.anotherCallback.calls.count(), 3);
            expect(this.neverCalled).not.toHaveBeenCalled();
            done();
        }));
    });
}));
