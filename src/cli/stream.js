/**
 * Printing the daemon's events as they arrive, for a command that runs until
 * it's stopped, such as `watch`.
 * @module @converse/cli/stream
 */

/**
 * Prints each event the client's subscriptions send, until the stream is
 * stopped or the daemon closes the connection.
 *
 * Whatever `subscribe` resolves with is printed first, in one write, and the
 * events that arrived in the meantime after it, so that a catch-up comes
 * before what's live.
 * @param {import('@converse/daemon/client').Client} client
 * @param {Object} options
 * @param {(client: import('@converse/daemon/client').Client) => Promise<string>} options.subscribe -
 *  Makes the subscriptions, and resolves with the text to print before the events
 * @param {(client: import('@converse/daemon/client').Client) => Promise<unknown>} [options.unsubscribe] -
 *  Ends the subscriptions as the stream is stopped. The events that arrive before it
 *  resolves are printed too: a subscription that marks what it sends seen has marked them.
 * @param {(event: import('@converse/daemon/types').Event) => string} options.format
 * @param {(text: string) => void} options.write
 * @param {number} [options.batch] - Gather what arrives within this many seconds into one write
 * @param {AbortSignal} [options.signal] - Stops the stream
 * @returns {Promise<void>} Resolves once stopped, or rejects with a
 *  `DaemonUnavailableError` once the connection closes
 */
export async function stream(client, { subscribe, unsubscribe, format, write, batch = 0, signal }) {
    const output = createBatcher(write, batch);
    /** @type {string[]|null} Events held until the text `subscribe` resolves with is printed */
    let held = [];
    // The client can't drop a listener, and events can still come as the connection closes.
    let stopped = false;
    client.onEvent((event) => {
        if (stopped) return;

        if (held) held.push(format(event));
        else output.push(format(event));
    });
    try {
        const first = await subscribe(client);
        if (first) write(first);
        const early = held;
        held = null;
        early.forEach((text) => output.push(text));

        if (!signal?.aborted) {
            const aborted = new Promise((resolve) => signal?.addEventListener('abort', resolve, { once: true }));
            await Promise.race([client.closed, aborted]);
        }
        // Stopped, not closed: what the daemon sent until it took the unsubscribe is still coming.
        // Once the connection closes, nothing more can be.
        await unsubscribe?.(client).catch(() => {});
    } finally {
        stopped = true;
        output.flush();
    }
}

/**
 * Gathers text into one write per window of `seconds`. A window starts with
 * the first text after the last write, so that none waits longer than
 * `seconds`. With no window, each text is written at once.
 * @param {(text: string) => void} write
 * @param {number} seconds
 */
export function createBatcher(write, seconds) {
    /** @type {string[]} */
    let buffered = [];
    /** @type {ReturnType<typeof setTimeout>|null} */
    let timer = null;

    const flush = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        if (buffered.length === 0) return;

        const text = buffered.join('');
        buffered = [];
        write(text);
    };

    return {
        /** @param {string} text */
        push(text) {
            if (!(seconds > 0)) return write(text);

            buffered.push(text);
            timer ??= setTimeout(flush, seconds * 1000);
        },
        /** Writes whatever is buffered now. */
        flush,
    };
}
