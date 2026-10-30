/**
 * The CLI reaching a daemon on another host, through sockets its config names,
 * as an SSH socket forward (`ssh -L`) puts them. A relay between two unix
 * sockets stands in for SSH: like it, it accepts a connection whether or not
 * anything answers on the other side, and closes it if nothing does.
 */
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run, runFrom } from './run.js';

const JULIET = 'juliet@capulet.lit';

/**
 * Listens on `listen_path` and relays each connection to `target_path`.
 * @param {string} listen_path
 * @param {string} target_path
 * @returns {Promise<net.Server>}
 */
function relay(listen_path, target_path) {
    const server = net.createServer((local) => {
        const remote = net.createConnection(target_path);
        local.pipe(remote).pipe(local);
        remote.on('error', () => local.destroy());
        local.on('error', () => remote.destroy());
        local.on('close', () => remote.destroy());
    });
    return new Promise((resolve) => server.listen(listen_path, () => resolve(server)));
}

describe('converse-cli through a tunnel to another host', () => {
    let daemon, dir, http_server, file;
    /** @type {net.Server[]} */
    const relays = [];

    /**
     * A client host of its own: XDG directories with a password-less copy of
     * the account's config, naming the given sockets.
     * @param {string} name
     * @param {Record<string, string>} sockets
     * @returns {Promise<NodeJS.ProcessEnv>}
     */
    async function clientHost(name, sockets) {
        const home = path.join(dir, name);
        const env = {
            ...process.env,
            XDG_CONFIG_HOME: path.join(home, 'config'),
            XDG_RUNTIME_DIR: path.join(home, 'run'),
            XDG_STATE_HOME: path.join(home, 'state'),
        };
        await fs.mkdir(path.join(env.XDG_CONFIG_HOME, 'converse'), { recursive: true });
        await fs.writeFile(
            path.join(env.XDG_CONFIG_HOME, 'converse', 'daemon.json'),
            JSON.stringify({ jid: 'romeo@montague.lit', owner: 'benvolio@montague.lit', access: 'full', ...sockets }),
        );
        return env;
    }

    /**
     * @param {string} name - The forwarded socket's file name, in the tunnel directory
     * @param {string} target
     */
    async function forward(name, target) {
        const listen_path = path.join(dir, 'tunnel', name);
        relays.push(await relay(listen_path, target));
        return listen_path;
    }

    beforeAll(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-cli-tunnel-test-'));
        await fs.mkdir(path.join(dir, 'tunnel'), { mode: 0o700 });
        // Only in the client host's directory, where the daemon has no reason to look.
        await fs.mkdir(path.join(dir, 'files'));
        file = path.join(dir, 'files', 'balcony.txt');
        await fs.writeFile(file, 'Arise, fair sun');
        http_server = http.createServer((request, response) => {
            let body = '';
            request.on('data', (d) => (body += d));
            request.on('end', () => {
                http_server.uploaded = body;
                response.writeHead(201).end();
            });
        });
        await new Promise((resolve) => http_server.listen(0, '127.0.0.1', resolve));
        const { port } = http_server.address();
        daemon = await startDaemon({
            roster: [{ jid: JULIET, name: 'Juliet Capulet' }],
            upload_service: {
                jid: 'upload.montague.lit',
                put_url: `http://127.0.0.1:${port}/put/balcony.txt`,
                get_url: `http://127.0.0.1:${port}/get/balcony.txt`,
                max_file_size: 1024,
            },
        });
    });

    afterAll(async () => {
        await daemon?.stop();
        await Promise.all(relays.map((r) => new Promise((resolve) => r.close(resolve))));
        await new Promise((resolve) => http_server?.close(resolve));
        await fs.rm(dir, { recursive: true, force: true });
    });

    it('reaches the daemon through the forwarded socket, and says which socket that was', async () => {
        const socket = await forward('full.sock', daemon.config.paths.socket);
        const env = await clientHost('laptop', { socket });
        const { code, stdout, stderr } = await run(env, 'daemon', 'status');
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toMatch(/^connected as romeo@montague\.lit\/orchard, pid \d+, up \d+s, on (.+)\n$/);
        expect(stdout.endsWith(`, on ${socket}\n`)).toBe(true);

        const status = JSON.parse((await run(env, 'daemon', 'status', '--json')).stdout);
        expect(status).toMatchObject({ connected: true, socket });
    });

    it('uploads a file the daemon is given the contents of, not a path to read', async () => {
        const socket = await forward('upload.sock', daemon.config.paths.socket);
        const env = await clientHost('upload', { socket });
        // A relative path, which resolves only in the CLI's directory.
        const { code, stdout, stderr } = await runFrom(
            path.dirname(file),
            env,
            '',
            'upload',
            JULIET,
            path.basename(file),
        );
        expect({ code, stderr }).toEqual({ code: EXIT.OK, stderr: '' });
        expect(stdout).toMatch(/^Uploaded "balcony\.txt" to juliet@capulet\.lit as .+\n$/);
        expect(http_server.uploaded).toBe('Arise, fair sun');
    });

    it("doesn't start a daemon when the configured socket is missing, and says what to check", async () => {
        const socket = path.join(dir, 'tunnel', 'missing.sock');
        const env = await clientHost('down', { socket });
        const { code, stdout, stderr } = await run(env, 'daemon', 'start');
        expect({ code, stdout }).toEqual({ code: EXIT.DAEMON_UNAVAILABLE, stdout: '' });
        expect(stderr).toBe(
            `converse-cli: No daemon answers on ${socket}, the "socket" that ` +
                `${path.join(env.XDG_CONFIG_HOME, 'converse', 'daemon.json')} names (ENOENT). Check that the ` +
                "tunnel to the daemon's host is up, and that the daemon runs on that host. This client doesn't " +
                'start a daemon when the config names a socket.\n',
        );
        // No daemon was started: it would have made its log and runtime directory.
        await expect(fs.stat(env.XDG_STATE_HOME)).rejects.toThrow('ENOENT');
        await expect(fs.stat(env.XDG_RUNTIME_DIR)).rejects.toThrow('ENOENT');
    });

    it('says what to check when the tunnel is up and nothing answers on the other host', async () => {
        const socket = await forward('dangling.sock', path.join(dir, 'gone.sock'));
        const env = await clientHost('dangling', { socket });
        const { code, stderr } = await run(env, 'daemon', 'status');
        expect(code).toBe(EXIT.DAEMON_UNAVAILABLE);
        expect(stderr).toContain(`No daemon answers on ${socket}, the "socket" that `);
        expect(stderr).toContain("(the connection was closed). Check that the tunnel to the daemon's host is up");
    });

    it('fails clearly on what needs full access, when only the restricted socket is forwarded', async () => {
        const restricted_socket = await forward('agent.sock', daemon.config.paths.restricted_socket);
        const expected = {
            code: EXIT.ERROR,
            stdout: '',
            stderr:
                'converse-cli: This needs full access, and this client can only reach the restricted socket. ' +
                "It is the owner's to do, from a client with full access.\n",
        };
        // Only the restricted socket is configured.
        let env = await clientHost('agent', { restricted_socket });
        expect(await run(env, 'drafts', 'list')).toEqual(expected);

        // Both are configured, and the full one's tunnel leads nowhere.
        const socket = await forward('agent-full.sock', path.join(dir, 'gone.sock'));
        env = await clientHost('agent-both', { socket, restricted_socket });
        expect(await run(env, 'drafts', 'list')).toEqual(expected);
    });

    it('reads at restricted access through a forward of the restricted socket alone', async () => {
        const restricted_socket = await forward('reader.sock', daemon.config.paths.restricted_socket);
        const env = await clientHost('reader', { restricted_socket });
        const config = path.join(env.XDG_CONFIG_HOME, 'converse', 'daemon.json');
        const raw = JSON.parse(await fs.readFile(config, 'utf8'));
        await fs.writeFile(config, JSON.stringify({ ...raw, access: 'restricted' }));
        const { code, stdout } = await run(env, 'contacts');
        expect(code).toBe(EXIT.OK);
        expect(stdout).toContain(JULIET);
    });

    it('stops the daemon on the other host, returning once it has closed the connection', async () => {
        const socket = await forward('stop.sock', daemon.config.paths.socket);
        const env = await clientHost('stopper', { socket });
        expect(await run(env, 'daemon', 'stop')).toEqual({
            code: EXIT.OK,
            stdout: 'Asked the daemon to stop. It has closed the connection.\n',
            stderr: '',
        });
        // It closed the connection on its way out, before removing its socket.
        const exists = () =>
            fs.stat(daemon.config.paths.socket).then(
                () => true,
                () => false,
            );
        await expect.poll(exists).toBe(false);
        expect((await run(env, 'daemon', 'stop')).stdout).toBe("The daemon wasn't running.\n");
    });
});
