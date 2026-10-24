import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPassword, loadConfig } from '../config.js';

describe('The account configuration', () => {
    let dir, env;

    /**
     * @param {Object} config
     */
    const writeConfig = (config) => fs.writeFile(path.join(dir, 'converse', 'daemon.json'), JSON.stringify(config));

    /**
     * Puts a stand-in for the platform's keyring tool on PATH that prints
     * `password` for the given account, and fails for any other.
     * @param {string} account
     * @param {string} password
     */
    async function installKeyring(account, password) {
        const bin = path.join(dir, 'bin');
        await fs.mkdir(bin, { recursive: true });
        const script = `#!/bin/sh\ncase "$*" in *"${account}"*) printf '%s\\n' '${password}' ;; *) exit 1 ;; esac\n`;
        for (const name of ['secret-tool', 'security']) {
            await fs.writeFile(path.join(bin, name), script, { mode: 0o755 });
        }
        env.PATH = bin;
    }

    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-config-test-'));
        await fs.mkdir(path.join(dir, 'converse'));
        env = { XDG_CONFIG_HOME: dir, XDG_RUNTIME_DIR: path.join(dir, 'run'), PATH: '' };
    });

    afterEach(() => fs.rm(dir, { recursive: true, force: true }));

    it('fills in defaults and derives the per-account paths', async () => {
        await writeConfig({ jid: ' Romeo@Montague.lit ', websocket_url: 'wss://montague.lit/ws' });
        expect(loadConfig(env)).toEqual({
            jid: 'romeo@montague.lit',
            password: undefined,
            websocket_url: 'wss://montague.lit/ws',
            resource: 'claude',
            consumer: 'claude',
            access: 'restricted',
            policy: { allow: [], rate_limit: { per_conversation: 5, overall: 20, window: 60 } },
            settings: {},
            paths: {
                config: path.join(dir, 'converse', 'daemon.json'),
                runtime_dir: path.join(dir, 'run', 'converse'),
                socket: path.join(dir, 'run', 'converse', 'romeo@montague.lit.sock'),
                restricted_socket: path.join(dir, 'run', 'converse', 'romeo@montague.lit.restricted.sock'),
                pidfile: path.join(dir, 'run', 'converse', 'romeo@montague.lit.pid'),
                log: expect.stringMatching(/\/converse\/romeo@montague\.lit\.log$/),
                cursors: expect.stringMatching(/\/converse\/romeo@montague\.lit\.cursors\.json$/),
                audit: expect.stringMatching(/\/converse\/romeo@montague\.lit\.audit\.jsonl$/),
            },
        });
    });

    it('reads the access level and the send policy, lowercasing the allowlist', async () => {
        await writeConfig({
            jid: 'romeo@montague.lit',
            access: 'full',
            policy: { allow: ['Juliet@Capulet.lit '], rate_limit: { overall: 3 } },
        });
        const { access, policy } = loadConfig(env);
        expect(access).toBe('full');
        expect(policy).toEqual({
            allow: ['juliet@capulet.lit'],
            rate_limit: { per_conversation: 5, overall: 3, window: 60 },
        });
    });

    it('refuses an access level it does not know', async () => {
        await writeConfig({ jid: 'romeo@montague.lit', access: 'root' });
        expect(() => loadConfig(env)).toThrow('"access" in');
        expect(() => loadConfig(env)).toThrow('must be one of: restricted, full.');
    });

    it('refuses a send policy it cannot use', async () => {
        await writeConfig({ jid: 'romeo@montague.lit', policy: { allow: ['juliet'] } });
        expect(() => loadConfig(env)).toThrow('"policy.allow" in');
        await writeConfig({ jid: 'romeo@montague.lit', policy: { rate_limit: { overall: 0 } } });
        expect(() => loadConfig(env)).toThrow('"policy.rate_limit.overall" in');
    });

    it('names the socket after a hash of the JID when the JID would make its path too long', async () => {
        const jid = `${'r'.repeat(60)}@montague.lit`;
        await writeConfig({ jid });
        const { socket, pidfile } = loadConfig(env).paths;
        expect(path.basename(socket)).toMatch(/^[0-9a-f]{16}\.sock$/);
        expect(path.basename(pidfile)).toBe(path.basename(socket).replace('.sock', '.pid'));
        expect(Buffer.byteLength(socket)).toBeLessThanOrEqual(103);
    });

    it('wants a bare JID', async () => {
        await writeConfig({ jid: 'romeo@montague.lit/orchard' });
        expect(() => loadConfig(env)).toThrow('"jid" in');
        expect(() => loadConfig(env)).toThrow('must be a bare JID such as "you@example.org".');
    });

    it('takes the password from the config file if it has one', async () => {
        await writeConfig({ jid: 'romeo@montague.lit', password: 'from-config' });
        await installKeyring('romeo@montague.lit', 'from-keyring');
        expect(await getPassword(loadConfig(env), env)).toBe('from-config');
    });

    it('otherwise takes the password from the system keyring', async () => {
        await writeConfig({ jid: 'romeo@montague.lit' });
        await installKeyring('romeo@montague.lit', 'from keyring');
        expect(await getPassword(loadConfig(env), env)).toBe('from keyring');
    });

    it('says how to store a password when there is none', async () => {
        await writeConfig({ jid: 'romeo@montague.lit' });
        await installKeyring('juliet@capulet.lit', 'not-for-romeo');
        await expect(getPassword(loadConfig(env), env)).rejects.toThrow(
            /^No password for romeo@montague\.lit\. Store one in the system keyring with "(secret-tool|security) /,
        );
    });
});
