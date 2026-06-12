import mock from '../../tests/mock.js';
import converse from '../../../../dist/converse.js';

/**
 * Override the read-only `document.visibilityState` and fire a
 * `visibilitychange` event, so focus-dependent behaviour can be driven.
 * @param {DocumentVisibilityState} state
 */
function setVisibilityState(state) {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
}

function restoreVisibilityState() {
    delete (/** @type {any} */ (document)).visibilityState;
}

describe("An ObservableElement with observable='always' and observableRequireFocus", function () {
    it(
        'fires its visibility handler each time it is in view AND the tab is focused',
        mock.initConverse(converse, [], {}, async function () {
            // ObservableElement isn't exported on the public API, so we reach it
            // via the prototype chain of a registered subclass.
            await customElements.whenDefined('converse-chat-message');
            const ObservableElement = Object.getPrototypeOf(customElements.get('converse-chat-message'));

            // Stub out the real IntersectionObserver; intersection is driven
            // manually below via `handleIntersectionCallback`.
            spyOn(window, 'IntersectionObserver').and.returnValue(
                /** @type {any} */ ({ observe() {}, unobserve() {}, disconnect() {} }),
            );

            if (!customElements.get('test-observable-always')) {
                class TestObservableAlways extends ObservableElement {
                    constructor() {
                        super();
                        this.observable = 'always';
                        this.observableRequireFocus = true;
                        this.seen = 0;
                    }
                    onVisibilityChanged() {
                        this.seen++;
                    }
                }
                customElements.define('test-observable-always', TestObservableAlways);
            }

            const el = /** @type {any} */ (document.createElement('test-observable-always'));
            document.body.appendChild(el);
            await el.updateComplete;

            try {
                // In view, but on a background tab: not yet "seen".
                setVisibilityState('hidden');
                el.handleIntersectionCallback([/** @type {any} */ ({ intersectionRatio: 1 })]);
                expect(el.seen).toBe(0);

                // Returning to the tab while still in view fires the handler.
                setVisibilityState('visible');
                expect(el.seen).toBe(1);

                // 'always' keeps firing: scroll out of view, then back in.
                el.handleIntersectionCallback([/** @type {any} */ ({ intersectionRatio: 0 })]);
                el.handleIntersectionCallback([/** @type {any} */ ({ intersectionRatio: 1 })]);
                expect(el.seen).toBe(2);

                // Blur and re-focus while still in view: fires again. (An
                // `observable === 'once'` element would have stopped after the
                // first sighting.)
                setVisibilityState('hidden');
                setVisibilityState('visible');
                expect(el.seen).toBe(3);
            } finally {
                restoreVisibilityState();
                el.remove();
            }
        }),
    );

    it(
        'stops firing once disconnected',
        mock.initConverse(converse, [], {}, async function () {
            await customElements.whenDefined('converse-chat-message');
            spyOn(window, 'IntersectionObserver').and.returnValue(
                /** @type {any} */ ({ observe() {}, unobserve() {}, disconnect() {} }),
            );

            const el = /** @type {any} */ (document.createElement('test-observable-always'));
            document.body.appendChild(el);
            await el.updateComplete;

            try {
                setVisibilityState('visible');
                el.handleIntersectionCallback([/** @type {any} */ ({ intersectionRatio: 1 })]);
                expect(el.seen).toBe(1);

                // After removal the 'visibilitychange' listener is torn down, so
                // toggling focus must not fire the handler again.
                el.remove();
                setVisibilityState('hidden');
                setVisibilityState('visible');
                expect(el.seen).toBe(1);
            } finally {
                restoreVisibilityState();
                el.remove();
            }
        }),
    );
});
