import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };

const BIN = fileURLToPath(new URL('../bin/converse-cli.js', import.meta.url));

/**
 * Runs the CLI as its own process, as an agent's shell would.
 * @param {string[]} args
 */
async function run(...args) {
    try {
        const { stdout, stderr } = await promisify(execFile)(process.execPath, [BIN, ...args]);
        return { code: 0, stdout, stderr };
    } catch (e) {
        return { code: e.code, stdout: e.stdout, stderr: e.stderr };
    }
}

describe('converse-cli', () => {
    it('prints its version', async () => {
        expect(await run('--version')).toEqual({ code: 0, stdout: `${pkg.version}\n`, stderr: '' });
    });

    it('prints usage when given no command', async () => {
        const { code, stdout } = await run();
        expect(code).toBe(0);
        expect(stdout).toMatch(/^Usage: converse-cli <command>/);
    });

    it('fails on an unknown command, saying what to do next', async () => {
        const { code, stderr } = await run('frobnicate');
        expect(code).not.toBe(0);
        expect(stderr).toContain('converse-cli --help');
    });
});
