import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBatcher, stream } from '../stream.js';

describe('A stream batcher', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('writes each text at once without a window', () => {
        const write = vi.fn();
        const batcher = createBatcher(write, 0);
        batcher.push('a\n');
        batcher.push('b\n');
        expect(write.mock.calls).toEqual([['a\n'], ['b\n']]);
    });

    it('writes what arrives within the window of the first text, in one write when it ends', () => {
        const write = vi.fn();
        const batcher = createBatcher(write, 5);
        batcher.push('a\n');
        vi.advanceTimersByTime(3000);
        batcher.push('b\n');
        expect(write).not.toHaveBeenCalled();

        // The window is the first text's: the second doesn't extend it.
        vi.advanceTimersByTime(2000);
        expect(write.mock.calls).toEqual([['a\nb\n']]);
    });

    it('starts the next window with the next text', () => {
        const write = vi.fn();
        const batcher = createBatcher(write, 5);
        batcher.push('a\n');
        vi.advanceTimersByTime(5000);
        vi.advanceTimersByTime(60000);
        batcher.push('b\n');
        vi.advanceTimersByTime(4999);
        expect(write.mock.calls).toEqual([['a\n']]);

        vi.advanceTimersByTime(1);
        expect(write.mock.calls).toEqual([['a\n'], ['b\n']]);
    });

    it('writes what it holds when flushed, and nothing when it holds nothing', () => {
        const write = vi.fn();
        const batcher = createBatcher(write, 5);
        batcher.flush();
        batcher.push('a\n');
        batcher.flush();
        vi.advanceTimersByTime(5000);
        expect(write.mock.calls).toEqual([['a\n']]);
    });
});

describe('A stream', () => {
    /** A client whose events the test sends, and whose connection never closes by itself. */
    function fakeClient() {
        const listeners = new Set();
        return {
            closed: new Promise(() => {}),
            onEvent: (listener) => listeners.add(listener),
            emit: (text) => listeners.forEach((listener) => listener(text)),
        };
    }

    it('prints the catch-up first, then what arrived while subscribing, then what is live', async () => {
        const client = fakeClient();
        const subscribed = Promise.withResolvers();
        const write = vi.fn();
        const controller = new AbortController();
        const streaming = stream(/** @type {any} */ (client), {
            subscribe: () => subscribed.promise,
            format: (event) => `${event}\n`,
            write,
            signal: controller.signal,
        });
        client.emit('early');
        expect(write).not.toHaveBeenCalled();

        subscribed.resolve('caught up\n');
        await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
        client.emit('live');
        controller.abort();
        await streaming;
        expect(write.mock.calls).toEqual([['caught up\n'], ['early\n'], ['live\n']]);
    });

    it('takes no more events once stopped, so a batch window keeps none open', async () => {
        vi.useFakeTimers();
        try {
            const client = fakeClient();
            const write = vi.fn();
            const controller = new AbortController();
            const streaming = stream(/** @type {any} */ (client), {
                subscribe: () => Promise.resolve(''),
                format: (event) => `${event}\n`,
                write,
                batch: 60,
                signal: controller.signal,
            });
            controller.abort();
            await streaming;

            client.emit('late');
            expect(vi.getTimerCount()).toBe(0);
            expect(write).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('prints what arrives until the unsubscribe is answered, once stopped', async () => {
        const client = fakeClient();
        const write = vi.fn();
        const controller = new AbortController();
        const answered = Promise.withResolvers();
        const unsubscribe = vi.fn(() => answered.promise);
        const streaming = stream(/** @type {any} */ (client), {
            subscribe: () => Promise.resolve(''),
            unsubscribe,
            format: (event) => `${event}\n`,
            write,
            signal: controller.signal,
        });
        controller.abort();
        await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalledOnce());
        // Sent, and marked seen, before the daemon took the unsubscribe.
        client.emit('in flight');
        answered.resolve();
        await streaming;

        client.emit('late');
        expect(write.mock.calls).toEqual([['in flight\n']]);
    });

    it('stops all the same when the unsubscribe fails, as once the connection has closed', async () => {
        const client = fakeClient();
        const controller = new AbortController();
        controller.abort();
        await stream(/** @type {any} */ (client), {
            subscribe: () => Promise.resolve(''),
            unsubscribe: () => Promise.reject(new Error('The connection to the daemon is closed.')),
            format: (event) => `${event}\n`,
            write: vi.fn(),
            signal: controller.signal,
        });
    });
});
