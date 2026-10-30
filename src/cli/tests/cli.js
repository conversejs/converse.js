import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '@converse/daemon/client';
import { createAccount, JID } from '../../daemon/tests/account.js';
import { EXIT } from '../exit-codes.js';
import pkg from '../package.json' with { type: 'json' };
import { HELP } from '../help.js';
import { main } from '../cli.js';
import { run } from './run.js';

/**
 * Runs the CLI in this process, for what needs no daemon, such as help.
 * @param {NodeJS.ProcessEnv} env
 * @param {...string} args
 */
async function capture(env, ...args) {
    let stdout = '';
    let stderr = '';
    const code = await main(args, { out: (t) => (stdout += t), err: (t) => (stderr += t), env });
    return { code, stdout, stderr };
}

describe('converse-cli', () => {
    let account;

    beforeAll(async () => {
        account = await createAccount();
    });

    afterAll(async () => {
        // Don't leave a daemon behind if a spec failed halfway.
        const { pidfile } = loadConfig(account.env).paths;
        if (fs.existsSync(pidfile)) process.kill(parseInt(fs.readFileSync(pidfile, 'utf8'), 10), 'SIGTERM');
        await account.remove();
    });

    it('prints its version', async () => {
        expect(await run(account.env, '--version')).toEqual({ code: EXIT.OK, stdout: `${pkg.version}\n`, stderr: '' });
    });

    it('prints usage when given no command', async () => {
        const { code, stdout } = await run(account.env);
        expect(code).toBe(EXIT.OK);
        expect(stdout).toMatch(/^Usage: converse-cli <command>/);
        expect(stdout).toContain(`${account.env.XDG_CONFIG_HOME}/converse/daemon.json`);
    });

    it("documents every command's arguments, options, exit codes and examples", async () => {
        for (const name of Object.keys(HELP)) {
            const words = name.split(' ');
            const asked = await capture(account.env, 'help', ...words);
            expect(asked.code, name).toBe(EXIT.OK);
            expect(await capture(account.env, ...words, '--help'), name).toEqual(asked);

            const { stdout } = asked;
            expect(stdout.startsWith(`Usage: converse-cli ${name}`), name).toBe(true);
            HELP[name].args?.forEach(([arg]) => expect(stdout, name).toContain(`\n  ${arg}`));
            expect(stdout, name).toMatch(/\nOptions:\n {2}(--\w|-h)/);
            expect(stdout, name).toMatch(/\nExit codes:\n {2}0 {3}ok\n/);
            expect(stdout, name).toMatch(
                new RegExp(`\\nExamples?:\\n {2}converse-cli ${name}|\\| converse-cli ${name}`),
            );
            // Nothing runs off the edge of a terminal, except an example, which must stay whole.
            stdout
                .split('\n')
                .filter((line) => !line.includes('converse-cli '))
                .forEach((line) => expect(line.length, `${name}: ${line}`).toBeLessThanOrEqual(80));
        }
    });

    it('shows the help of each subcommand of a group, and says a group needs one', async () => {
        const { code, stdout } = await capture(account.env, 'help', 'drafts');
        expect(code).toBe(EXIT.OK);
        expect(stdout).toContain('Usage: converse-cli drafts list');
        expect(stdout).toContain('Usage: converse-cli drafts reject <id>');

        expect(await capture(account.env, 'drafts')).toEqual({
            code: EXIT.ERROR,
            stdout: '',
            stderr:
                'converse-cli: "drafts" needs one of: list, show, send, reject. ' +
                'Run "converse-cli help drafts" for each one\'s usage.\n',
        });
    });

    it("refuses an option the command doesn't take, rather than ignoring it", async () => {
        expect(await capture(account.env, 'send', 'juliet@capulet.lit', '--limit', '3', 'hi')).toEqual({
            code: EXIT.ERROR,
            stdout: '',
            stderr: 'converse-cli: send doesn\'t take --limit. Run "converse-cli help send" for its options.\n',
        });
    });

    it('fails on an unknown command, saying what to do next', async () => {
        const { code, stderr } = await run(account.env, 'frobnicate');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toBe(
            'converse-cli: unknown command "frobnicate". Run "converse-cli --help" to list commands.\n',
        );
    });

    it('treats only its own commands as commands, not names inherited from JavaScript objects', async () => {
        const { code, stderr } = await run(account.env, 'constructor');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toBe(
            'converse-cli: unknown command "constructor". Run "converse-cli --help" to list commands.\n',
        );
    });

    it('never accepts credentials as arguments', async () => {
        const { code, stderr } = await run(account.env, 'daemon', 'start', '--password', 'secret');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toMatch(/^converse-cli: Unknown option '--password'/);
    });

    it('says how to configure an account when there is none', async () => {
        const env = { ...account.env, XDG_CONFIG_HOME: `${account.env.XDG_CONFIG_HOME}/nowhere` };
        const { code, stderr } = await run(env, 'daemon', 'start');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toContain(`No account configured. Create ${env.XDG_CONFIG_HOME}/converse/daemon.json`);
    });

    it('starts the daemon on demand, reports its status and stops it', async () => {
        const { env } = account;

        let result = await run(env, 'daemon', 'status');
        expect(result.code).toBe(EXIT.DAEMON_UNAVAILABLE);
        expect(result.stderr).toBe(
            "converse-cli: The daemon for romeo@montague.lit isn't running. " +
                'Start it with "converse-cli daemon start".\n',
        );

        result = await run(env, 'daemon', 'start');
        expect(result.code).toBe(EXIT.OK);
        // The CLI connects at restricted access, unless the config says otherwise.
        const socket = loadConfig(env).paths.restricted_socket;
        expect(result.stdout.replace(/pid \d+, up \d+s/, 'pid <pid>, up <n>s')).toBe(
            `connected as ${JID}, pid <pid>, up <n>s, on ${socket}\n`,
        );

        result = await run(env, 'daemon', 'status', '--json');
        expect(result.code).toBe(EXIT.OK);
        const status = JSON.parse(result.stdout);
        expect(status).toMatchObject({ connected: true, jid: JID, socket });
        // The daemon outlives the CLI process that started it.
        expect(status.pid).not.toBe(process.pid);
        expect(() => process.kill(status.pid, 0)).not.toThrow();

        result = await run(env, 'daemon', 'stop');
        expect(result).toEqual({ code: EXIT.OK, stdout: 'Stopped.\n', stderr: '' });
        expect(fs.existsSync(loadConfig(env).paths.socket)).toBe(false);

        result = await run(env, 'daemon', 'stop');
        expect(result).toEqual({ code: EXIT.OK, stdout: "The daemon wasn't running.\n", stderr: '' });
    }, 20000);

    it('lets SIGTERM stop the daemon cleanly', async () => {
        const { env } = account;
        expect((await run(env, 'daemon', 'start')).code).toBe(EXIT.OK);
        const { pidfile, socket } = loadConfig(env).paths;
        const pid = parseInt(fs.readFileSync(pidfile, 'utf8'), 10);

        process.kill(pid, 'SIGTERM');
        await vi.waitUntil(() => !fs.existsSync(pidfile), { timeout: 10000 });
        expect(fs.existsSync(socket)).toBe(false);
        await vi.waitUntil(
            () => {
                try {
                    process.kill(pid, 0);
                    return false;
                } catch {
                    return true;
                }
            },
            { timeout: 10000 },
        );
    }, 20000);
});
