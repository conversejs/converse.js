/**
 * The restricted socket for an agent that can't read the daemon's files: one
 * in a sandbox given only the socket's directory, or one running as another
 * OS user in the socket's group.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connect, DaemonUnavailableError } from '../client.js';
import { loadConfig } from '../config.js';
import { start } from '../daemon.js';
import { ERRORS, PROTOCOL_VERSION } from '../protocol.js';
import { createAccount } from './account.js';
import { JID, startDaemon } from './harness.js';

/**
 * A group the test's user is in. Its primary group, as in a sandbox the others
 * can be unmapped (the overflow gid), which nobody can chown to.
 */
const GROUP = process.getgid();

const mode = async (file) => (await fs.stat(file)).mode & 0o777;

describe('The restricted socket', () => {
    let daemon;
    /** @type {string[]} */
    let dirs = [];

    afterEach(async () => {
        await daemon?.stop();
        daemon = undefined;
        await Promise.all(dirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
        dirs = [];
    });

    /**
     * An environment with none of the account's config, as an agent has.
     * @param {string} socket - What CONVERSE_SOCKET names
     */
    async function clientEnv(socket) {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-client-test-'));
        dirs.push(dir);
        return {
            ...process.env,
            XDG_CONFIG_HOME: path.join(dir, 'config'),
            XDG_RUNTIME_DIR: path.join(dir, 'run'),
            XDG_STATE_HOME: path.join(dir, 'state'),
            CONVERSE_SOCKET: socket,
        };
    }

    /** A directory for the restricted socket, outside the runtime directory. */
    async function outsideDir() {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-restricted-test-'));
        dirs.push(dir);
        return path.join(dir, 'agent');
    }

    it('is in a directory of its own, without the full socket or the pidfile, owner-only by default', async () => {
        daemon = await startDaemon();
        const { paths } = daemon.config;
        expect(path.dirname(paths.restricted_socket)).toBe(paths.restricted_dir);
        expect(await fs.readdir(paths.restricted_dir)).toEqual(['sock']);
        expect(await mode(paths.restricted_dir)).toBe(0o700);
        expect(await mode(paths.restricted_socket)).toBe(0o600);
    });

    it('opens to the configured group, and leaves the full socket and the rest owner-only', async () => {
        daemon = await startDaemon({ socket_group: String(GROUP) });
        const { paths } = daemon.config;
        expect(await mode(paths.restricted_dir)).toBe(0o750);
        expect(await mode(paths.restricted_socket)).toBe(0o660);
        expect((await fs.stat(paths.restricted_dir)).gid).toBe(GROUP);
        expect((await fs.stat(paths.restricted_socket)).gid).toBe(GROUP);

        expect(await mode(paths.socket)).toBe(0o600);
        expect(await mode(paths.runtime_dir)).toBe(0o700);
        expect(await mode(paths.pidfile)).toBe(0o600);
    });

    it('takes the group by name', async () => {
        const name = execFileSync('id', ['-gn'], { encoding: 'utf8' }).trim();
        daemon = await startDaemon({ socket_group: name });
        expect((await fs.stat(daemon.config.paths.restricted_socket)).gid).toBe(process.getgid());
        expect(await mode(daemon.config.paths.restricted_socket)).toBe(0o660);
    });

    it("refuses to start for a group that doesn't exist, and releases its pidfile", async () => {
        const { env, remove } = await createAccount({}, { socket_group: 'no-such-group-for-converse' });
        const config = loadConfig(env);
        try {
            await expect(start(config)).rejects.toThrow(
                '"socket_group" names the group "no-such-group-for-converse", which doesn\'t exist.',
            );
            await expect(fs.stat(config.paths.pidfile)).rejects.toThrow('ENOENT');
        } finally {
            await remove();
        }
    });

    const other_group = process.getuid() !== 0 && !process.getgroups().includes(0) ? 0 : null;

    it.skipIf(other_group === null)("refuses to start for a group the daemon's user isn't in", async () => {
        const { env, remove } = await createAccount({}, { socket_group: String(other_group) });
        try {
            await expect(start(loadConfig(env))).rejects.toThrow(
                `The daemon's user isn't in the group "${other_group}" that "socket_group" names.`,
            );
        } finally {
            await remove();
        }
    });

    it('goes in the directory "restricted_dir" names, which outlives a restart', async () => {
        const restricted_dir = await outsideDir();
        daemon = await startDaemon({ restricted_dir, socket_group: String(GROUP) });
        const { config } = daemon;
        expect(config.paths.restricted_socket).toBe(path.join(restricted_dir, 'sock'));
        expect(await mode(restricted_dir)).toBe(0o750);
        const { ino } = await fs.stat(restricted_dir);

        await daemon.daemon.stop();
        // Only the socket went: a sandbox bound to the directory still has it.
        expect(await fs.readdir(restricted_dir)).toEqual([]);

        daemon.daemon = await start(config);
        expect((await fs.stat(restricted_dir)).ino).toBe(ino);
        const client = await connect({ env: await clientEnv(config.paths.restricted_socket) });
        expect(client.hello.access).toBe('restricted');
        client.close();
    });

    it("refuses a restricted_dir that isn't a directory of its own, such as a symlink", async () => {
        const restricted_dir = await outsideDir();
        await fs.symlink(os.tmpdir(), restricted_dir);
        const { env, remove } = await createAccount({}, { restricted_dir });
        const config = loadConfig(env);
        try {
            await expect(start(config)).rejects.toThrow(
                `${restricted_dir}, the restricted socket's directory, isn't a directory of the daemon's own user.`,
            );
            await expect(fs.stat(config.paths.pidfile)).rejects.toThrow('ENOENT');
        } finally {
            await remove();
        }
    });

    describe('reached with CONVERSE_SOCKET', () => {
        it("connects at restricted access without the account's config, and learns the mode", async () => {
            daemon = await startDaemon({ mode: 'bot' });
            const env = await clientEnv(daemon.config.paths.restricted_socket);
            expect(() => loadConfig(env)).toThrow('No account configured.');

            const client = await connect({ env });
            expect(client.hello).toEqual({
                protocol: PROTOCOL_VERSION,
                consumer: 'agent',
                access: 'restricted',
                mode: 'bot',
                jid: JID,
            });
            expect(await client.request('daemon.status')).toMatchObject({ connected: true });
            await expect(client.request('drafts.list')).rejects.toMatchObject({ code: ERRORS.ACCESS_DENIED });
            client.close();
        });

        it('never starts a daemon, and says so when none answers', async () => {
            const missing = path.join(await outsideDir(), 'sock');
            const env = await clientEnv(missing);
            const error = await connect({ env }).catch((e) => e);
            expect(error).toBeInstanceOf(DaemonUnavailableError);
            expect(error.message).toBe(
                `No daemon answers on ${missing}, the socket CONVERSE_SOCKET names (ENOENT). This client has no ` +
                    'account config to start one with: ask the user to start the daemon, and check that this ' +
                    'path is its restricted socket.',
            );
            await expect(fs.stat(env.XDG_STATE_HOME)).rejects.toThrow('ENOENT');
        });

        it('wants an absolute path', async () => {
            await expect(connect({ env: await clientEnv('converse/sock') })).rejects.toThrow(
                'CONVERSE_SOCKET must be the absolute path',
            );
        });
    });
});
