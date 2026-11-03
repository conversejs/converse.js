/**
 * Where the daemons on this host can be found: the runtime directory, and the
 * record each running daemon leaves there under its account's name. Free of
 * any `@converse/headless` import, so that a client can read it too.
 * @module @converse/daemon/registry
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Where the daemons keep their sockets and pidfiles.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function getRuntimeDir(env = process.env) {
    return env.XDG_RUNTIME_DIR
        ? path.join(env.XDG_RUNTIME_DIR, 'converse')
        : path.join(os.tmpdir(), `converse-${process.getuid()}`);
}

/**
 * Refuses a runtime directory that isn't the user's own, such as one another
 * user made first in a shared place like `/tmp`: the records and sockets in
 * it could be theirs. One that isn't there yet has nothing in it to trust.
 * @param {string} dir
 * @param {Object} [options]
 * @param {boolean} [options.check_mode] - Also refuse one that others may write in
 */
export function checkRuntimeDir(dir, { check_mode = true } = {}) {
    let stat;
    try {
        stat = fs.lstatSync(dir);
    } catch (e) {
        if (e.code === 'ENOENT') return;
        throw e;
    }
    if (!stat.isDirectory() || stat.uid !== process.getuid()) {
        throw new Error(
            `${dir}, where the daemons keep their sockets, isn't a directory of this user's own. ` +
                'Another user may have made it: remove it, or set XDG_RUNTIME_DIR to a directory only this user can enter.',
        );
    }
    if (check_mode && stat.mode & 0o077) {
        throw new Error(
            `${dir}, where the daemons keep their sockets, is open to other users. ` +
                `Make it owner-only with "chmod 700 ${dir}".`,
        );
    }
}

/**
 * The running daemons, from the records they leave in the runtime directory.
 * A record whose daemon is gone, after a crash, is left out.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {import('./types').DaemonRecord[]}
 */
export function listDaemons(env = process.env) {
    return daemonsIn(getRuntimeDir(env));
}

/**
 * @param {string} runtime_dir
 * @returns {import('./types').DaemonRecord[]} The running daemons that left a record in `runtime_dir`
 */
export function daemonsIn(runtime_dir) {
    checkRuntimeDir(runtime_dir);
    const dir = path.join(runtime_dir, 'accounts');
    let files = [];
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        if (e.code !== 'ENOENT') throw e;
    }
    return files
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => readRecord(path.join(dir, f)))
        .filter((record) => record && isRunning(record.pid));
}

/**
 * The record of the account's running daemon, if it has one: the JID it was
 * started with, which the config's may no longer be, and where it listens.
 * @param {import('./types').Config} config
 * @returns {import('./types').DaemonRecord|null}
 */
export function findDaemon(config) {
    checkRuntimeDir(config.paths.runtime_dir);
    const record = readRecord(config.paths.record);
    return record && isRunning(record.pid) ? record : null;
}

/**
 * Leaves a record of this daemon under its account's name, so that clients
 * find it by name. A daemon already running for the same JID under another
 * account is refused: logged in twice, each would knock the other off.
 * @param {import('./types').Config} config
 */
export async function writeRecord(config) {
    const { account, jid, paths } = config;
    const running = daemonsIn(paths.runtime_dir).find((d) => d.jid === jid && d.account !== account);
    if (running) {
        throw new Error(
            `A daemon for ${jid} is already running, for the account "${running.account}" (pid ${running.pid}). ` +
                'Stop it with "daemon.stop".',
        );
    }
    /** @type {import('./types').DaemonRecord} */
    const record = {
        account,
        jid,
        pid: process.pid,
        started: new Date().toISOString(),
        socket: paths.socket,
        restricted_socket: paths.restricted_socket,
        pidfile: paths.pidfile,
        log: paths.log,
    };
    await fsp.mkdir(path.dirname(paths.record), { recursive: true, mode: 0o700 });
    // Written whole, then renamed, so that a client never reads half of it.
    const tmp = `${paths.record}.${process.pid}`;
    await fsp.writeFile(tmp, JSON.stringify(record) + '\n', { mode: 0o600 });
    await fsp.rename(tmp, paths.record);
}

/**
 * Removes this daemon's record, and leaves another daemon's alone.
 * @param {import('./types').Config} config
 */
export async function removeRecord(config) {
    if (findDaemon(config)?.pid === process.pid) await fsp.rm(config.paths.record, { force: true });
}

/**
 * @param {string} file
 * @returns {import('./types').DaemonRecord|null}
 */
function readRecord(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        // None, or one a daemon is still writing.
        return null;
    }
}

/**
 * @param {number} pid
 */
export function isRunning(pid) {
    if (!pid) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return e.code === 'EPERM';
    }
}
