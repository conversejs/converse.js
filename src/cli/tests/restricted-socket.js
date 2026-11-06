/**
 * The CLI given only the restricted socket, with CONVERSE_SOCKET, and none of
 * the account's config: what an agent in a sandbox, or running as another OS
 * user, has. How the daemon serves that socket is covered at the protocol seam.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run } from './run.js';

const JULIET = 'juliet@capulet.lit';

describe('converse-cli with CONVERSE_SOCKET', () => {
    let daemon, dir, env;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet Capulet' }],
            mode: 'as_user',
            owner: 'romeo@montague.lit',
            policy: { allow: [JULIET] },
        });
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-cli-socket-test-'));
        env = {
            ...process.env,
            XDG_CONFIG_HOME: path.join(dir, 'config'),
            XDG_RUNTIME_DIR: path.join(dir, 'run'),
            XDG_STATE_HOME: path.join(dir, 'state'),
            CONVERSE_SOCKET: daemon.config.paths.restricted_socket,
        };
    });

    afterAll(async () => {
        await daemon?.stop();
        await fs.rm(dir, { recursive: true, force: true });
    });

    it('works without the config, at restricted access', async () => {
        const { code, stdout } = await run(env, 'contacts');
        expect(code).toBe(EXIT.OK);
        expect(stdout).toContain(JULIET);
    });

    it("words a draft for the daemon's mode, which it learns from the daemon", async () => {
        const { code, stdout } = await run(env, 'send', JULIET, 'Noon?');
        expect(code).toBe(EXIT.DRAFT);
        expect(stdout).toBe('Drafted as d1. Nothing was sent: it waits for the user to approve it.\n');
    });

    it("can't do what needs full access", async () => {
        const { code, stderr } = await run(env, 'drafts', 'send', 'd1');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toBe(
            'converse-cli: "drafts.send" is only available at full access, and this connection is restricted.\n',
        );
    });

    it('says in its help that it uses the socket and reads no config', async () => {
        const { stdout } = await run(env, '--help');
        expect(stdout).toContain(`CONVERSE_SOCKET points this client at the daemon's socket`);
        expect(stdout).not.toContain('The account is configured in');
    });

    it("doesn't start a daemon when none answers, and exits with the daemon unavailable code", async () => {
        const missing = path.join(dir, 'missing.sock');
        const { code, stderr } = await run({ ...env, CONVERSE_SOCKET: missing }, 'daemon', 'start');
        expect(code).toBe(EXIT.DAEMON_UNAVAILABLE);
        expect(stderr).toContain(`No daemon answers on ${missing}, the socket CONVERSE_SOCKET names`);
        await expect(fs.stat(env.XDG_STATE_HOME)).rejects.toThrow('ENOENT');
    });
});
