/**
 * The account's pidfile, which lets one daemon run per account. Daemons for
 * the same account can start at once, when two clients each start one, so
 * taking the pidfile must leave exactly one of them holding it.
 * Free of any `@converse/headless` import, so that a client can check it too.
 * @module @converse/daemon/pidfile
 */
import fs from 'node:fs/promises';

/** How often a claim is tried again after a stale pidfile was cleared, before giving up. */
const MAX_ATTEMPTS = 3;

/**
 * Takes the pidfile for `pid`. A pidfile naming a process that's gone is
 * stale and gets replaced.
 * @param {string} pidfile
 * @param {Object} options
 * @param {string} options.jid - The account's JID, for the error
 * @param {number} [options.pid] - The process taking it
 * @throws {Error} When a running daemon holds it
 */
export async function claimPidfile(pidfile, { jid, pid = process.pid }) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (await create(pidfile, pid)) return;

        const text = await read(pidfile);
        // Gone since: its daemon stopped, or another start cleared it as stale.
        if (text === null) continue;

        const holder = parseInt(text, 10);
        if (isRunning(holder)) {
            throw new Error(`A daemon for ${jid} is already running (pid ${holder}). Stop it with "converse-cli daemon stop".`);
        }
        await removeStale(pidfile, text, pid);
    }
    throw new Error(`Couldn't take ${pidfile}: other daemons for ${jid} kept taking it. Try again.`);
}

/**
 * The pid of the running process that holds the pidfile, if one does.
 * @param {string} pidfile
 * @returns {Promise<number|null>}
 */
export async function pidfileHolder(pidfile) {
    const text = await read(pidfile);
    const pid = text === null ? NaN : parseInt(text, 10);
    return isRunning(pid) ? pid : null;
}

/**
 * Creates the pidfile with the pid already in it, so that it's never seen
 * empty: it's written beside the pidfile, then linked in, which fails if a
 * pidfile is already there.
 * @param {string} pidfile
 * @param {number} pid
 * @returns {Promise<boolean>} Whether it was created, rather than there already
 */
async function create(pidfile, pid) {
    const temp = `${pidfile}.${pid}.tmp`;
    await fs.writeFile(temp, `${pid}\n`, { mode: 0o600 });
    try {
        await fs.link(temp, pidfile);
        return true;
    } catch (e) {
        if (e.code === 'EEXIST') return false;
        throw e;
    } finally {
        await fs.rm(temp, { force: true });
    }
}

/**
 * Removes a stale pidfile, unless another daemon has replaced it since it
 * was read. It's moved aside first, which only one process can do, and put
 * back if what was moved isn't what was read.
 * @param {string} pidfile
 * @param {string} stale - The stale pidfile's contents, as read
 * @param {number} pid - The process clearing it
 */
async function removeStale(pidfile, stale, pid) {
    const aside = `${pidfile}.${pid}.stale`;
    try {
        await fs.rename(pidfile, aside);
    } catch (e) {
        if (e.code === 'ENOENT') return;
        throw e;
    }
    if ((await read(aside)) !== stale) {
        // Another daemon took the pidfile in between. If yet another has taken
        // its place since, that one holds it now.
        await fs.link(aside, pidfile).catch((e) => {
            if (e.code !== 'EEXIST') throw e;
        });
    }
    await fs.rm(aside, { force: true });
}

/**
 * @param {number} pid
 */
function isRunning(pid) {
    if (!pid) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return e.code === 'EPERM';
    }
}

/**
 * @param {string} file
 * @returns {Promise<string|null>} Its contents, or null if it isn't there
 */
async function read(file) {
    try {
        return await fs.readFile(file, 'utf8');
    } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
    }
}
