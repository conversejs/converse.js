#!/usr/bin/env node
import { main } from '../cli.js';

/** @type {AbortController|null} */
let stopping = null;

/**
 * Made only for a command that asks for it, as only such a command stops
 * by itself on Ctrl-C: for every other, the signal ends the process as usual.
 * A second Ctrl-C still does.
 */
function stopSignal() {
    if (!stopping) {
        stopping = new AbortController();
        const stop = () => stopping.abort();
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
        // The reader went away, as `head` does once it has its lines.
        process.stdout.on('error', (e) => {
            if (/** @type {NodeJS.ErrnoException} */ (e).code !== 'EPIPE') throw e;
            stop();
        });
    }
    return stopping.signal;
}

process.exitCode = await main(process.argv.slice(2), {
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
    env: process.env,
    stdin: process.stdin,
    stopSignal,
});
