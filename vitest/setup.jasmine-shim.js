/**
 * Jasmine -> Vitest compatibility shim.
 *
 * The Converse test suite was written for Jasmine. Rather than rewrite ~540 spy
 * call-sites and a custom matcher across 144 spec files, this setup file installs
 * the small slice of the Jasmine global API that the suite
 * actually uses, mapped onto Vitest primitives (`vi`, `expect`).
 *
 * Loaded via `test.setupFiles`, so these globals exist before any spec or
 * `mock.js` is imported (mock.js touches `jasmine`/`fail` at module top-level).
 *
 * `describe`/`it`/`expect`/`beforeAll`/`beforeEach`/... come from `globals: true`
 * in vitest.config.js; we only add what Vitest doesn't provide.
 */
import { vi, expect, it, describe } from 'vitest';

let _timeout = 7000;

/** A *constructable* implementation that returns `v` (so `new spy()` yields `v`). */
function returnFn(v) {
    return function () {
        return v;
    };
}

/**
 * Augment a Vitest mock fn with a Jasmine-compatible `.and` / `.calls` facade so
 * existing call-sites (`spy.and.returnValue(x)`, `spy.calls.count()`, ...) work
 * unchanged. The returned object is still the same Vitest mock, so native
 * matchers (`toHaveBeenCalledWith`, ...) keep working too.
 */
function augment(spy) {
    Object.defineProperty(spy, 'and', {
        configurable: true,
        get() {
            return {
                callFake: (fn) => (spy.mockImplementation(fn), spy),
                // Use mockImplementation with a *regular* function (not an arrow):
                // Jasmine's returnValue spies can be invoked with `new` (a constructor
                // returning an object makes `new` yield it). mockReturnValue is rejected
                // by Vitest for `new`, and an arrow fn throws "is not a constructor".
                returnValue: (v) => (spy.mockImplementation(returnFn(v)), spy),
                returnValues: (...vs) => (vs.forEach((v) => spy.mockImplementationOnce(returnFn(v))), spy),
                callThrough: () => {
                    const original = spy.__converse_original;
                    if (original) {
                        spy.mockImplementation(function (...args) {
                            return original.apply(this, args);
                        });
                    }
                    return spy;
                },
                throwError: (e) => (
                    spy.mockImplementation(() => {
                        throw e instanceof Error ? e : new Error(e);
                    }),
                    spy
                ),
                resolveTo: (v) => (spy.mockResolvedValue(v), spy),
                rejectWith: (v) => (spy.mockRejectedValue(v), spy),
                stub: () => (spy.mockImplementation(() => {}), spy),
            };
        },
    });

    const callInfo = (i) => ({
        get args() {
            return spy.mock.calls[i];
        },
        get returnValue() {
            return spy.mock.results[i]?.value;
        },
        get object() {
            return spy.mock.instances[i];
        },
    });

    Object.defineProperty(spy, 'calls', {
        configurable: true,
        get() {
            const m = spy.mock;
            return {
                count: () => m.calls.length,
                any: () => m.calls.length > 0,
                argsFor: (i) => m.calls[i],
                allArgs: () => m.calls,
                all: () => m.calls.map((_, i) => callInfo(i)),
                first: () => callInfo(0),
                mostRecent: () => callInfo(m.calls.length - 1),
                reset: () => spy.mockClear(),
            };
        },
    });

    return spy;
}

/** Jasmine's `spyOn` defaults to a no-op stub; Vitest's `vi.spyOn` calls through. */
globalThis.spyOn = (obj, method) => {
    const original = obj[method];
    const spy = vi.spyOn(obj, method);
    spy.__converse_original = original;
    spy.mockImplementation(() => {}); // match Jasmine's stub-by-default behaviour
    return augment(spy);
};

globalThis.fail = (e) => {
    throw e instanceof Error ? e : new Error(String(e ?? 'failed'));
};

// Jasmine's focused/excluded variants. Vitest exposes the equivalents as `.only`
// / `.skip`; alias them so the documented `fdescribe`/`fit` debugging workflow (and
// any `xdescribe`/`xit` left in specs) keeps working unchanged. NB: under Vitest a
// focused test only narrows *within its own file* — pass a file path to scope a run.
globalThis.fdescribe = (...args) => describe.only(...args);
globalThis.fit = (...args) => it.only(...args);
globalThis.xdescribe = (...args) => describe.skip(...args);
globalThis.xit = (...args) => it.skip(...args);

globalThis.jasmine = {
    // asymmetric matchers
    any: (ctor) => expect.any(ctor),
    anything: () => expect.anything(),
    objectContaining: (o) => expect.objectContaining(o),
    arrayContaining: (a) => expect.arrayContaining(a),
    stringMatching: (s) => expect.stringMatching(s),

    createSpy: (_name, fn) => augment(vi.fn(fn)),
    createSpyObj: (_name, methods) => {
        // Jasmine allows ('name', ['a','b']) or ('name', {a: retval}); also the
        // 2-arg form where the first arg is the methods themselves.
        const m = methods ?? _name;
        const obj = {};
        if (Array.isArray(m)) {
            m.forEach((n) => (obj[n] = augment(vi.fn())));
        } else {
            Object.entries(m).forEach(([n, ret]) => (obj[n] = augment(vi.fn(returnFn(ret)))));
        }
        return obj;
    },

    addMatchers: (matchers) => {
        const adapted = {};
        for (const [name, factory] of Object.entries(matchers)) {
            adapted[name] = function (received, ...args) {
                const result = factory.call(this).compare(received, ...args);
                return { pass: result.pass, message: () => result.message ?? `expected ${name} to pass` };
            };
        }
        expect.extend(adapted);
    },

    clock: () => ({
        install() {
            vi.useFakeTimers();
            return this;
        },
        uninstall() {
            vi.useRealTimers();
        },
        mockDate(date) {
            vi.setSystemTime(date ?? new Date());
        },
        tick(ms) {
            vi.advanceTimersByTime(ms);
        },
    }),

    get DEFAULT_TIMEOUT_INTERVAL() {
        return _timeout;
    },
    set DEFAULT_TIMEOUT_INTERVAL(v) {
        _timeout = v;
        vi.setConfig({ testTimeout: v });
    },
};

// Jasmine matchers that Vitest doesn't ship.
expect.extend({
    toBeTrue: (received) => ({
        pass: received === true,
        message: () => `expected ${received} to be true`,
    }),
    toBeFalse: (received) => ({
        pass: received === false,
        message: () => `expected ${received} to be false`,
    }),
    toHaveSize: (received, size) => ({
        pass: (received?.length ?? Object.keys(received ?? {}).length) === size,
        message: () => `expected size ${size}`,
    }),
    nothing: () => ({ pass: true, message: () => '' }),
    toHaveBeenCalledOnceWith: function (received, ...expected) {
        const calls = received?.mock?.calls ?? [];
        const pass =
            calls.length === 1 &&
            this.equals(
                calls[0],
                expected.map((e) => e),
            );
        return {
            pass,
            message: () => `expected spy to have been called exactly once with the given args`,
        };
    },
});
