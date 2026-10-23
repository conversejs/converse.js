#!/usr/bin/env node
/**
 * converse-cli: a short-lived command line client of the Converse daemon.
 * Each invocation connects to the daemon's socket, makes one request, prints
 * the result and exits.
 */
import pkg from '../package.json' with { type: 'json' };

const USAGE = `Usage: converse-cli <command> [options]

Read and send XMPP messages through a running Converse daemon.

Options:
  -h, --help      Show this help and exit
  -v, --version   Show the version and exit
`;

const [arg] = process.argv.slice(2);

if (arg === '-v' || arg === '--version') {
    process.stdout.write(`${pkg.version}\n`);
} else if (arg === undefined || arg === '-h' || arg === '--help') {
    process.stdout.write(USAGE);
} else {
    process.stderr.write(`converse-cli: unknown command "${arg}". Run "converse-cli --help" to list commands.\n`);
    process.exitCode = 1;
}
