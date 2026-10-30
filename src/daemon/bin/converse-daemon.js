#!/usr/bin/env node
/**
 * Runs the daemon for the configured account in the foreground until it's
 * stopped by SIGTERM, SIGINT or a client's `daemon.stop` request. Clients
 * normally start it themselves when they find no socket.
 *
 * `CONVERSE_ACCOUNT` names the account. Without it, it's the default one.
 */
import { loadConfig } from '../config.js';
import { start } from '../daemon.js';

let daemon;
try {
    daemon = await start(loadConfig());
} catch (e) {
    process.stderr.write(`converse-daemon: ${e.message}\n`);
    process.exit(1);
}

for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => daemon.stop());
}

await daemon.stopped;
process.exit(0);
