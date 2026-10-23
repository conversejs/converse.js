import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/converse-cli.js', import.meta.url));

/**
 * Runs the CLI as its own process, as an agent's shell would, with an empty
 * stdin.
 * @param {NodeJS.ProcessEnv} env
 * @param {...string} args
 */
export function run(env, ...args) {
    return runWithInput(env, '', ...args);
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} input - Written to its stdin, which is then closed.
 * @param {...string} args
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function runWithInput(env, input, ...args) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [BIN, ...args], { env });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => (stdout += d));
        child.stderr.on('data', (d) => (stderr += d));
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));
        child.stdin.end(input);
    });
}
