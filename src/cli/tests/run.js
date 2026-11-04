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
    return runFrom(undefined, env, input, ...args);
}

/**
 * Runs the CLI in the directory `cwd`, so that a relative path it's given
 * resolves there and nowhere else.
 * @param {string|undefined} cwd - Unset runs it in this process's directory
 * @param {NodeJS.ProcessEnv} env
 * @param {string} input - Written to its stdin, which is then closed.
 * @param {...string} args
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function runFrom(cwd, env, input, ...args) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [BIN, ...args], { env, cwd });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => (stdout += d));
        child.stderr.on('data', (d) => (stderr += d));
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));
        child.stdin.end(input);
    });
}

/**
 * Starts the CLI as its own process, for a command that runs until it's
 * stopped, such as `watch`.
 * @param {NodeJS.ProcessEnv} env
 * @param {...string} args
 */
export function start(env, ...args) {
    const child = spawn(process.execPath, [BIN, ...args], { env });
    const output = { stdout: '', stderr: '', /** @type {string[]} Each chunk read from stdout */ chunks: [] };
    child.stdout.on('data', (d) => {
        output.stdout += d;
        output.chunks.push(String(d));
    });
    child.stderr.on('data', (d) => (output.stderr += d));
    child.stdin.end();
    /** @type {Promise<number>} */
    const exited = new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => resolve(code));
    });

    /**
     * Resolves once `test` passes on what has been printed, or rejects
     * if the process exits first, or after `ms`.
     * @param {(output: { stdout: string, stderr: string, chunks: string[] }) => boolean} test
     * @param {number} [ms]
     */
    async function until(test, ms = 10000) {
        const deadline = Date.now() + ms;
        let done = false;
        exited.then(() => (done = true));
        while (!test(output)) {
            if (done) throw new Error(`Exited before expected. stdout: ${output.stdout} stderr: ${output.stderr}`);
            if (Date.now() > deadline) {
                throw new Error(`Timed out. stdout: ${output.stdout} stderr: ${output.stderr}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
    }

    return {
        child,
        output,
        until,
        /** Resolves once the process is listening: its notice is on stderr. */
        started: () => until(({ stderr }) => stderr.length > 0),
        /**
         * Sends `signal` (SIGINT by default), and resolves with how it exited.
         * @param {NodeJS.Signals} [signal]
         */
        async stop(signal = 'SIGINT') {
            child.kill(signal);
            return { code: await exited, ...output };
        },
        /** How it exited, once it does by itself. */
        exited: async () => ({ code: await exited, ...output }),
    };
}
