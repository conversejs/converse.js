#!/usr/bin/env node
import { main } from '../cli.js';

process.exitCode = await main(process.argv.slice(2), {
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
    env: process.env,
    stdin: process.stdin,
});
