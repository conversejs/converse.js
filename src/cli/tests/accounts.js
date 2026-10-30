import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listDaemons } from '@converse/daemon/client';
import { createAccount } from '../../daemon/tests/account.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

describe('converse-cli with several accounts', () => {
    let account, env, juliet_config;

    beforeAll(async () => {
        // daemon.json is Romeo's, the default account.
        account = await createAccount();
        env = account.env;
        const config_dir = path.join(env.XDG_CONFIG_HOME, 'converse');
        const romeo = JSON.parse(fs.readFileSync(path.join(config_dir, 'daemon.json'), 'utf8'));
        // Without a storage_path of its own, so that Juliet's database is where her account puts it.
        const { storage_path: _, ...settings } = romeo.settings;
        juliet_config = path.join(config_dir, 'accounts', 'juliet.json');
        fs.mkdirSync(path.dirname(juliet_config));
        fs.writeFileSync(
            juliet_config,
            JSON.stringify({ ...romeo, jid: 'juliet@capulet.lit', resource: 'balcony', settings }),
        );
    });

    afterAll(async () => {
        // Don't leave a daemon behind if a spec failed halfway.
        listDaemons(env).forEach(({ pid }) => process.kill(pid, 'SIGTERM'));
        await account.remove();
    });

    it('lists the configured accounts, marking the default', async () => {
        expect(await run(env, 'accounts')).toEqual({
            code: EXIT.OK,
            stdout: 'default  romeo@montague.lit  (default)\njuliet  juliet@capulet.lit\n',
            stderr: '',
        });
    });

    it('fails on an unknown account, listing those there are', async () => {
        const { code, stdout, stderr } = await run(env, 'daemon', 'status', '--account', 'tybalt');
        expect(code).toBe(EXIT.NOT_FOUND);
        expect(stdout).toBe('');
        expect(stderr).toBe(
            'converse-cli: No account is called "tybalt". Pick one of these with --account <name>, ' +
                `or create ${path.join(env.XDG_CONFIG_HOME, 'converse', 'accounts', 'tybalt.json')}.\n` +
                '  default\n  juliet\n',
        );
    });

    it('runs a daemon per account in parallel, reaching each by name, and stops one alone', async () => {
        /**
         * The pid of the daemon a command reaches. The mock connection binds
         * every account to the same JID, so the pid is what tells them apart.
         * @param {NodeJS.ProcessEnv} env
         * @param {...string} args
         */
        const pidOf = async (env, ...args) => {
            const { code, stdout, stderr } = await run(env, ...args, '--json');
            expect(code, stderr).toBe(EXIT.OK);
            return JSON.parse(stdout).pid;
        };
        const romeo = await pidOf(env, 'daemon', 'start');
        const juliet = await pidOf(env, '--account', 'juliet', 'daemon', 'start');
        expect(juliet).not.toBe(romeo);

        expect(await pidOf(env, 'daemon', 'status')).toBe(romeo);
        expect(await pidOf(env, 'daemon', 'status', '--account', 'juliet')).toBe(juliet);
        // CONVERSE_ACCOUNT picks the account too, and the option wins over it.
        const juliet_env = { ...env, CONVERSE_ACCOUNT: 'juliet' };
        expect(await pidOf(juliet_env, 'daemon', 'status')).toBe(juliet);
        expect(await pidOf(juliet_env, 'daemon', 'status', '--account', 'default')).toBe(romeo);

        let result = await run(env, 'daemon', 'status', '--all');
        expect(result.code).toBe(EXIT.OK);
        expect(result.stdout).toMatch(
            new RegExp(
                `^default  romeo@montague\\.lit  pid ${romeo}  up \\d+s\\n` +
                    `juliet  juliet@capulet\\.lit  pid ${juliet}  up \\d+s\\n$`,
            ),
        );

        // Juliet's database is in a directory of her own.
        expect(fs.readdirSync(path.join(env.XDG_STATE_HOME, 'converse', 'accounts', 'juliet'))).not.toEqual([]);

        // A changed JID doesn't hide the daemon still running with the old one.
        const config = JSON.parse(fs.readFileSync(juliet_config, 'utf8'));
        fs.writeFileSync(juliet_config, JSON.stringify({ ...config, jid: 'nurse@capulet.lit' }));
        expect(await pidOf(env, '--account', 'juliet', 'daemon', 'status')).toBe(juliet);

        result = await run(env, '--account', 'juliet', 'daemon', 'stop');
        expect(result).toEqual({ code: EXIT.OK, stdout: 'Stopped.\n', stderr: '' });

        // Romeo's daemon is still running, and is the only one.
        expect(await pidOf(env, 'daemon', 'status')).toBe(romeo);
        expect(listDaemons(env).map(({ account, pid }) => [account, pid])).toEqual([['default', romeo]]);

        result = await run(env, 'daemon', 'stop');
        expect(result).toEqual({ code: EXIT.OK, stdout: 'Stopped.\n', stderr: '' });
        result = await run(env, 'daemon', 'status', '--all');
        expect(result).toEqual({ code: EXIT.OK, stdout: '', stderr: 'No daemon is running.\n' });
    }, 30000);

    it('says so when several accounts are configured and none is the default', async () => {
        fs.renameSync(
            path.join(env.XDG_CONFIG_HOME, 'converse', 'daemon.json'),
            path.join(env.XDG_CONFIG_HOME, 'converse', 'accounts', 'romeo.json'),
        );
        const { code, stderr } = await run(env, 'daemon', 'status');
        expect(code).toBe(EXIT.AMBIGUOUS);
        expect(stderr).toBe(
            'converse-cli: Several accounts are configured, and none is the default. Pick one of these ' +
                'with --account <name>, or CONVERSE_ACCOUNT=<name>.\n  juliet\n  romeo\n',
        );
    });
});
