/**
 * Vitest global setup for real-server tests: makes sure Prosody is up, and
 * stops it afterwards only if it was started here. In CI it's started by an
 * earlier step, and left alone.
 */
import { start, stop } from './server.js';

export default async function setup() {
    const started = await start();
    return async () => {
        if (started) await stop();
    };
}
