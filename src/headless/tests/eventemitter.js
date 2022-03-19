/*global mock */

describe("The _converse Event Emitter", function() {

    it("allows you to subscribe to emitted events", mock.initConverse((_converse) => {
        window.callback = function () {};
        spyOn(window, 'callback');
        _converse.on('connected', window.callback);
        _converse.api.trigger('connected');
        expect(window.callback).toHaveBeenCalled();
        _converse.api.trigger('connected');
        expect(window.callback.calls.count(), 2);
        _converse.api.trigger('connected');
        expect(window.callback.calls.count(), 3);
    }));

    it("allows you to listen once for an emitted event", mock.initConverse((_converse) => {
        window.callback = function () {};
        spyOn(window, 'callback');
        _converse.once('connected', window.callback);
        _converse.api.trigger('connected');
        expect(window.callback).toHaveBeenCalled();
        _converse.api.trigger('connected');
        expect(window.callback.calls.count(), 1);
        _converse.api.trigger('connected');
        expect(window.callback.calls.count(), 1);
    }));

    it("allows you to stop listening or subscribing to an event", mock.initConverse((_converse) => {
        window.callback = function () {};
        window.anotherCallback = function () {};
        window.neverCalled = function () {};

        spyOn(window, 'callback');
        spyOn(window, 'anotherCallback');
        spyOn(window, 'neverCalled');
        _converse.on('connected', window.callback);
        _converse.on('connected', window.anotherCallback);

        _converse.api.trigger('connected');
        expect(window.callback).toHaveBeenCalled();
        expect(window.anotherCallback).toHaveBeenCalled();

        _converse.off('connected', window.callback);

        _converse.api.trigger('connected');
        expect(window.callback.calls.count(), 1);
        expect(window.anotherCallback.calls.count(), 2);

        _converse.once('connected', window.neverCalled);
        _converse.off('connected', window.neverCalled);

        _converse.api.trigger('connected');
        expect(window.callback.calls.count(), 1);
        expect(window.anotherCallback.calls.count(), 3);
        expect(window.neverCalled).not.toHaveBeenCalled();
    }));
});
