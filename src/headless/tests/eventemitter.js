import mock from "../tests/mock.js";

const container = {};

describe("The _converse Event Emitter", function() {

    it("allows you to subscribe to emitted events", mock.initConverse((_converse) => {
        container.callback = function () {};
        spyOn(container, 'callback');
        _converse.on('connected', container.callback);
        _converse.api.trigger('connected');
        expect(container.callback).toHaveBeenCalled();
        _converse.api.trigger('connected');
        expect(container.callback.calls.count(), 2);
        _converse.api.trigger('connected');
        expect(container.callback.calls.count(), 3);
    }));

    it("allows you to listen once for an emitted event", mock.initConverse((_converse) => {
        container.callback = function () {};
        spyOn(container, 'callback');
        _converse.once('connected', container.callback);
        _converse.api.trigger('connected');
        expect(container.callback).toHaveBeenCalled();
        _converse.api.trigger('connected');
        expect(container.callback.calls.count(), 1);
        _converse.api.trigger('connected');
        expect(container.callback.calls.count(), 1);
    }));

    it("allows you to stop listening or subscribing to an event", mock.initConverse((_converse) => {
        container.callback = function () {};
        container.anotherCallback = function () {};
        container.neverCalled = function () {};

        spyOn(container, 'callback');
        spyOn(container, 'anotherCallback');
        spyOn(container, 'neverCalled');
        _converse.on('connected', container.callback);
        _converse.on('connected', container.anotherCallback);

        _converse.api.trigger('connected');
        expect(container.callback).toHaveBeenCalled();
        expect(container.anotherCallback).toHaveBeenCalled();

        _converse.off('connected', container.callback);

        _converse.api.trigger('connected');
        expect(container.callback.calls.count(), 1);
        expect(container.anotherCallback.calls.count(), 2);

        _converse.once('connected', container.neverCalled);
        _converse.off('connected', container.neverCalled);

        _converse.api.trigger('connected');
        expect(container.callback.calls.count(), 1);
        expect(container.anotherCallback.calls.count(), 3);
        expect(container.neverCalled).not.toHaveBeenCalled();
    }));
});
