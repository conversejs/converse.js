import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountError, listAccounts, loadConfig } from '../config.js';
import { checkRuntimeDir, findDaemon, listDaemons } from '../registry.js';
import { getPassword, getRoomPasswords } from '../secrets.js';

describe('The account configuration', () => {
    let dir, env;

    /**
     * Writes the config file. An owner is filled in unless the test gives one,
     * since a config without one is refused.
     * @param {Object} config
     */
    const writeConfig = (config) =>
        fs.writeFile(
            path.join(dir, 'converse', 'accounts', 'default.json'),
            JSON.stringify({ owner: 'benvolio@montague.lit', ...config }),
        );

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
        await fs.mkdir(path.join(dir, 'converse', 'accounts'), { recursive: true });
        env = { XDG_CONFIG_HOME: dir, XDG_RUNTIME_DIR: path.join(dir, 'run'), PATH: '' };
    });

    afterEach(() => fs.rm(dir, { recursive: true, force: true }));

    it('fills in defaults and derives the per-account paths', async () => {
        await writeConfig({ jid: ' Romeo@Montague.lit ', websocket_url: 'wss://montague.lit/ws' });
        expect(loadConfig(env)).toEqual({
            account: 'default',
            jid: 'romeo@montague.lit',
            owner: 'benvolio@montague.lit',
            websocket_url: 'wss://montague.lit/ws',
            resource: 'agent',
            consumer: 'agent',
            access: 'restricted',
            mode: 'owner_only',
            allow_unencrypted_resend: false,
            socket_group: null,
            sockets: null,
            policy: {
                allow: [],
                direct: [],
                rooms: [],
                rate_limit: { per_conversation: 5, per_room: 2, overall: 20, window: 60 },
                presence: false,
            },
            rooms: [],
            settings: {},
            paths: {
                config: path.join(dir, 'converse', 'accounts', 'default.json'),
                runtime_dir: path.join(dir, 'run', 'converse'),
                socket: path.join(dir, 'run', 'converse', 'default.sock'),
                restricted_dir: path.join(dir, 'run', 'converse', 'default.restricted'),
                restricted_socket: path.join(dir, 'run', 'converse', 'default.restricted', 'sock'),
                pidfile: path.join(dir, 'run', 'converse', 'default.pid'),
                record: path.join(dir, 'run', 'converse', 'accounts', 'default.json'),
                storage: expect.stringMatching(/\/converse\/accounts\/default$/),
                log: expect.stringMatching(/\/converse\/accounts\/default\/daemon\.log$/),
                cursors: expect.stringMatching(/\/converse\/accounts\/default\/cursors\.json$/),
                audit: expect.stringMatching(/\/converse\/accounts\/default\/audit\.jsonl$/),
                drafts: expect.stringMatching(/\/converse\/accounts\/default\/drafts\.json$/),
                rooms: expect.stringMatching(/\/converse\/accounts\/default\/rooms\.json$/),
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
            direct: [],
            rooms: [],
            rate_limit: { per_conversation: 5, per_room: 2, overall: 3, window: 60 },
            presence: false,
        });
    });

    it('refuses a config with no owner, or whose owner is the agent itself', async () => {
        await writeConfig({ jid: 'romeo@montague.lit', owner: undefined });
        expect(() => loadConfig(env)).toThrow('"owner" in');
        await writeConfig({ jid: 'romeo@montague.lit', owner: 'romeo' });
        expect(() => loadConfig(env)).toThrow('"owner" in');
        await writeConfig({ jid: 'romeo@montague.lit', owner: 'Romeo@Montague.lit' });
        expect(() => loadConfig(env)).toThrow('must be a different account from "jid"');
    });

    it('refuses the owner being the agent itself in owner_only and bot modes', async () => {
        const load = () => loadConfig(env);
        for (const mode of ['owner_only', 'bot']) {
            await writeConfig({ jid: 'romeo@montague.lit', owner: 'romeo@montague.lit', mode });
            expect(load).toThrow('must be a different account from "jid"');
        }
    });

    it('reads the mode, which is owner_only unless the config says otherwise', async () => {
        await writeConfig({ jid: 'romeo@montague.lit' });
        expect(loadConfig(env).mode).toBe('owner_only');
        await writeConfig({ jid: 'romeo@montague.lit', mode: 'bot' });
        expect(loadConfig(env).mode).toBe('bot');
        await writeConfig({ jid: 'romeo@montague.lit', owner: 'romeo@montague.lit', mode: 'as_user' });
        expect(loadConfig(env).mode).toBe('as_user');
    });

    describe('in as_user mode', () => {
        it('takes the account itself as the owner, whether the config names it or leaves it out', async () => {
            await writeConfig({ jid: 'Romeo@Montague.lit', owner: 'romeo@montague.lit', mode: 'as_user' });
            expect(loadConfig(env)).toMatchObject({ jid: 'romeo@montague.lit', owner: 'romeo@montague.lit' });
            await writeConfig({ jid: 'romeo@montague.lit', owner: undefined, mode: 'as_user' });
            expect(loadConfig(env)).toMatchObject({ jid: 'romeo@montague.lit', owner: 'romeo@montague.lit' });
        });

        it('refuses an owner that is another account, since the agent acts as the owner', async () => {
            await writeConfig({ jid: 'romeo@montague.lit', owner: 'benvolio@montague.lit', mode: 'as_user' });
            expect(() => loadConfig(env)).toThrow(
                `"owner" in ${path.join(dir, 'converse', 'accounts', 'default.json')} must be the same account as "jid" ` +
                    'in "as_user" mode',
            );
        });

        it('refuses a policy.direct list, since nothing goes out without approval', async () => {
            await writeConfig({
                jid: 'romeo@montague.lit',
                owner: 'romeo@montague.lit',
                mode: 'as_user',
                policy: { direct: ['juliet@capulet.lit'] },
            });
            expect(() => loadConfig(env)).toThrow(
                `"policy.direct" in ${path.join(dir, 'converse', 'accounts', 'default.json')} can't be used in "as_user" mode`,
            );
            await writeConfig({
                jid: 'romeo@montague.lit',
                owner: 'romeo@montague.lit',
                mode: 'as_user',
                policy: { direct: [], allow: ['juliet@capulet.lit'] },
            });
            expect(loadConfig(env).policy).toMatchObject({ direct: [], allow: ['juliet@capulet.lit'] });
        });
    });

    it('refuses a mode it does not know, and names the ones it does', async () => {
        await writeConfig({ jid: 'romeo@montague.lit', mode: 'root' });
        expect(() => loadConfig(env)).toThrow(
            '"mode" in ' +
                path.join(dir, 'converse', 'accounts', 'default.json') +
                ' must be one of: owner_only, bot, as_user.',
        );
    });

    it('leaves unencrypted resends off unless the config allows them, and refuses a value that is not true or false', async () => {
        await writeConfig({ jid: 'romeo@montague.lit' });
        expect(loadConfig(env).allow_unencrypted_resend).toBe(false);
        await writeConfig({ jid: 'romeo@montague.lit', allow_unencrypted_resend: true });
        expect(loadConfig(env).allow_unencrypted_resend).toBe(true);
        await writeConfig({ jid: 'romeo@montague.lit', allow_unencrypted_resend: 'yes' });
        expect(() => loadConfig(env)).toThrow(
            '"allow_unencrypted_resend" in ' +
                path.join(dir, 'converse', 'accounts', 'default.json') +
                ' must be true or false.',
        );
    });

    it('reads the direct list, lowercasing it, and refuses one that is not a list of JIDs', async () => {
        await writeConfig({ jid: 'romeo@montague.lit', mode: 'bot', policy: { direct: ['Juliet@Capulet.lit'] } });
        expect(loadConfig(env).policy.direct).toEqual(['juliet@capulet.lit']);
        await writeConfig({ jid: 'romeo@montague.lit', policy: { direct: ['juliet'] } });
        expect(() => loadConfig(env)).toThrow('"policy.direct" in');
    });

    it('puts the restricted socket in the directory "restricted_dir" names, and refuses a relative one', async () => {
        await writeConfig({ jid: 'romeo@montague.lit', restricted_dir: '/srv/converse-agent' });
        expect(loadConfig(env).paths).toMatchObject({
            restricted_dir: '/srv/converse-agent',
            restricted_socket: '/srv/converse-agent/sock',
            socket: path.join(dir, 'run', 'converse', 'default.sock'),
        });
        await writeConfig({ jid: 'romeo@montague.lit', restricted_dir: 'converse-agent' });
        expect(() => loadConfig(env)).toThrow('"restricted_dir" in');
    });

    it('reads the sockets the config names, either or both, and refuses a relative one', async () => {
        await writeConfig({ jid: 'romeo@montague.lit', socket: '/tmp/tunnel/full.sock' });
        expect(loadConfig(env).sockets).toEqual({ socket: '/tmp/tunnel/full.sock', restricted_socket: null });
        await writeConfig({ jid: 'romeo@montague.lit', restricted_socket: '/tmp/tunnel/agent.sock' });
        expect(loadConfig(env).sockets).toEqual({ socket: null, restricted_socket: '/tmp/tunnel/agent.sock' });
        // The derived paths, which the daemon listens on, stay as they are.
        expect(loadConfig(env).paths.socket).toBe(path.join(dir, 'run', 'converse', 'default.sock'));
        const load = () => loadConfig(env);
        for (const key of ['socket', 'restricted_socket']) {
            await writeConfig({ jid: 'romeo@montague.lit', [key]: 'tunnel.sock' });
            expect(load).toThrow(`"${key}" in`);
        }
    });

    it('reads the socket group, by name or number, and refuses anything else', async () => {
        await writeConfig({ jid: 'romeo@montague.lit', socket_group: ' agents ' });
        expect(loadConfig(env).socket_group).toBe('agents');
        await writeConfig({ jid: 'romeo@montague.lit', socket_group: 1000 });
        expect(loadConfig(env).socket_group).toBe('1000');
        const load = () => loadConfig(env);
        for (const socket_group of ['', 1.5, true]) {
            await writeConfig({ jid: 'romeo@montague.lit', socket_group });
            expect(load).toThrow('"socket_group" in');
        }
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

    it("names the socket after a hash of the account's name when the name would make its path too long", async () => {
        const name = 'r'.repeat(64);
        await fs.writeFile(
            path.join(dir, 'converse', 'accounts', `${name}.json`),
            JSON.stringify({ jid: 'romeo@montague.lit', owner: 'benvolio@montague.lit' }),
        );
        const { socket, restricted_socket, pidfile, record } = loadConfig(env).paths;
        expect(path.basename(record)).toBe(`${name}.json`);
        expect(path.basename(socket)).toMatch(/^[0-9a-f]{16}\.sock$/);
        expect(path.basename(pidfile)).toBe(path.basename(socket).replace('.sock', '.pid'));
        expect(Buffer.byteLength(socket)).toBeLessThanOrEqual(103);
        expect(Buffer.byteLength(restricted_socket)).toBeLessThanOrEqual(103);
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
        // Read for the login only, never kept in the config.
        expect(loadConfig(env)).not.toHaveProperty('password');
    });

    it('lists the rooms to be in, and keeps their passwords out of the config', async () => {
        await writeConfig({
            jid: 'romeo@montague.lit',
            rooms: {
                'Garden@Conference.Montague.lit': { password: 'rosemary' },
                'hall@conference.montague.lit': { password: 'thyme' },
                'orchard@conference.montague.lit': {},
            },
        });
        const config = loadConfig(env);
        expect(config.rooms).toEqual([
            'garden@conference.montague.lit',
            'hall@conference.montague.lit',
            'orchard@conference.montague.lit',
        ]);
        expect(JSON.stringify(config)).not.toMatch(/rosemary|thyme/);
        expect(getRoomPasswords(config)).toEqual(
            new Map([
                ['garden@conference.montague.lit', 'rosemary'],
                ['hall@conference.montague.lit', 'thyme'],
            ]),
        );
    });

    it('refuses a "rooms" map it cannot use', async () => {
        const cases = [
            [['garden@conference.montague.lit'], 'must map room JIDs to their settings'],
            [{ garden: {} }, 'must be keyed by room JIDs, and "garden" isn\'t one'],
            [{ 'garden@conference.montague.lit': true }, 'must be an object'],
            [{ 'garden@conference.montague.lit': { password: '' } }, "must be the room's password"],
            [{ 'garden@conference.montague.lit': { autojoin: true } }, 'can only have a "password", not "autojoin"'],
            [{ 'Garden@conference.montague.lit': {}, 'garden@conference.montague.lit ': {} }, 'more than once'],
        ];
        const load = () => loadConfig(env);
        for (const [rooms, message] of cases) {
            await writeConfig({ jid: 'romeo@montague.lit', rooms });
            expect(load).toThrow(message);
        }
    });

    it('checks the room passwords again when it reads them, in case the file changed', async () => {
        await writeConfig({ jid: 'romeo@montague.lit', rooms: { 'garden@conference.montague.lit': {} } });
        const config = loadConfig(env);
        await writeConfig({ jid: 'romeo@montague.lit', rooms: { 'garden@conference.montague.lit': null } });
        expect(() => getRoomPasswords(config)).toThrow('must be an object');
    });

    it('trims the consumer name, which is also the nickname in rooms', async () => {
        await writeConfig({ jid: 'romeo@montague.lit', consumer: ' bot ' });
        expect(loadConfig(env).consumer).toBe('bot');
        await writeConfig({ jid: 'romeo@montague.lit', consumer: '  ' });
        expect(loadConfig(env).consumer).toBe('agent');
    });

    it('otherwise takes the password from the system keyring', async () => {
        await writeConfig({ jid: 'romeo@montague.lit' });
        await installKeyring('romeo@montague.lit', 'from keyring');
        expect(await getPassword(loadConfig(env), env)).toBe('from keyring');
    });

    it("doesn't trust the records in a runtime directory others can write in", async () => {
        await writeConfig({ jid: 'romeo@montague.lit', websocket_url: 'wss://montague.lit/ws' });
        const config = loadConfig(env);
        const { runtime_dir, record } = config.paths;
        expect(findDaemon(config)).toBe(null);

        await fs.mkdir(path.dirname(record), { recursive: true });
        await fs.writeFile(record, JSON.stringify({ account: 'default', pid: process.pid, socket: '/elsewhere' }));
        await fs.chmod(runtime_dir, 0o777);
        expect(() => findDaemon(config)).toThrow(/is open to other users/);
        expect(() => listDaemons(env)).toThrow(/is open to other users/);

        await fs.chmod(runtime_dir, 0o700);
        expect(findDaemon(config)).toMatchObject({ socket: '/elsewhere' });
    });

    it("refuses a runtime directory that isn't a directory of this user's own, such as a planted link", async () => {
        const target = path.join(dir, 'theirs');
        await fs.mkdir(target, { mode: 0o700 });
        await fs.mkdir(path.join(dir, 'run'));
        const runtime_dir = path.join(dir, 'run', 'converse');
        await fs.symlink(target, runtime_dir);
        for (const options of [{}, { check_mode: false }]) {
            expect(() => checkRuntimeDir(runtime_dir, options)).toThrow(/isn't a directory of this user's own/);
        }
    });

    it('says how to store a password when there is none', async () => {
        await writeConfig({ jid: 'romeo@montague.lit' });
        await installKeyring('juliet@capulet.lit', 'not-for-romeo');
        await expect(getPassword(loadConfig(env), env)).rejects.toThrow(
            /^No password for romeo@montague\.lit\. Store one in the system keyring with "(secret-tool|security) /,
        );
    });
});

describe('Account selection', () => {
    let dir, env;

    /**
     * Writes an account's config, accounts/<name>.json.
     * @param {string} name
     * @param {string} jid
     */
    async function writeAccount(name, jid) {
        const file = path.join(dir, 'converse', 'accounts', `${name}.json`);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, JSON.stringify({ jid, owner: 'benvolio@montague.lit' }));
    }

    /**
     * @param {() => unknown} fn
     * @returns {any} What `fn` threw
     */
    function thrown(fn) {
        try {
            fn();
        } catch (e) {
            return e;
        }
        throw new Error('Nothing was thrown');
    }

    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-accounts-test-'));
        env = {
            XDG_CONFIG_HOME: dir,
            XDG_RUNTIME_DIR: path.join(dir, 'run'),
            XDG_STATE_HOME: path.join(dir, 'state'),
        };
    });

    afterEach(() => fs.rm(dir, { recursive: true, force: true }));

    it('uses the account "default" when none is named, beside the named ones', async () => {
        await writeAccount('default', 'romeo@montague.lit');
        await writeAccount('juliet', 'juliet@capulet.lit');
        expect(listAccounts(env)).toEqual([
            { name: 'default', config: path.join(dir, 'converse', 'accounts', 'default.json'), default: true },
            { name: 'juliet', config: path.join(dir, 'converse', 'accounts', 'juliet.json'), default: false },
        ]);
        expect(loadConfig(env)).toMatchObject({ account: 'default', jid: 'romeo@montague.lit' });
        expect(loadConfig({ ...env, CONVERSE_ACCOUNT: 'juliet' })).toMatchObject({
            account: 'juliet',
            jid: 'juliet@capulet.lit',
        });
        expect(loadConfig({ ...env, CONVERSE_ACCOUNT: 'default' }).account).toBe('default');
    });

    it('uses the only account as the default when there is no account "default"', async () => {
        await writeAccount('juliet', 'juliet@capulet.lit');
        expect(listAccounts(env)).toEqual([expect.objectContaining({ name: 'juliet', default: true })]);
        expect(loadConfig(env).jid).toBe('juliet@capulet.lit');
    });

    it('lists the accounts when there are several and none is the default', async () => {
        await writeAccount('juliet', 'juliet@capulet.lit');
        await writeAccount('nurse', 'nurse@capulet.lit');
        expect(listAccounts(env).some((a) => a.default)).toBe(false);
        const error = thrown(() => loadConfig(env));
        expect(error).toBeInstanceOf(AccountError);
        expect(error.message).toBe(
            'Several accounts are configured, and none is the default. Pick one of these with ' +
                '--account <name>, or CONVERSE_ACCOUNT=<name>.',
        );
        expect(error.reason).toBe('ambiguous');
        expect(error.candidates).toEqual(['juliet', 'nurse']);
    });

    it('fails on an account that is not configured, listing those that are', async () => {
        await writeAccount('default', 'romeo@montague.lit');
        await writeAccount('juliet', 'juliet@capulet.lit');
        const error = thrown(() => loadConfig({ ...env, CONVERSE_ACCOUNT: 'tybalt' }));
        expect(error).toBeInstanceOf(AccountError);
        expect(error.message).toMatch(/^No account is called "tybalt"\. /);
        expect(error.reason).toBe('not_found');
        expect(error.candidates).toEqual(['default', 'juliet']);
    });

    it("keeps each account's database in a directory of its own", async () => {
        await writeAccount('default', 'romeo@montague.lit');
        await writeAccount('juliet', 'juliet@capulet.lit');
        const storage = (name) => loadConfig({ ...env, CONVERSE_ACCOUNT: name }).paths.storage;
        expect(storage('default')).toBe(path.join(dir, 'state', 'converse', 'accounts', 'default'));
        expect(storage('juliet')).toBe(path.join(dir, 'state', 'converse', 'accounts', 'juliet'));
    });

    it("keeps an account's files where they are when its JID changes", async () => {
        await writeAccount('default', 'romeo@montague.lit');
        const before = loadConfig(env).paths;
        await writeAccount('default', 'juliet@capulet.lit');
        expect(loadConfig(env).paths).toEqual(before);
    });
});
