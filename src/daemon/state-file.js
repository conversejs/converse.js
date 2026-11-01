/**
 * The JSON files in the account's state directory that the daemon keeps its
 * own state in, such as drafts and read cursors.
 * @module @converse/daemon/state-file
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Reads a state file. One that isn't there yet gives `empty`, but one that's
 * there and unreadable throws, so that it never quietly becomes empty.
 * @template T
 * @param {string} file
 * @param {T} empty - The state before anything was saved
 * @param {string} what - What the file holds, for the error
 * @returns {T}
 */
export function readStateFile(file, empty, what) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        if (e.code === 'ENOENT') return empty;
        throw new Error(`Couldn't read ${what} in ${file}: ${e.message}`, { cause: e });
    }
}

/**
 * Writes a state file that only the daemon user can read. It's written beside
 * the file and renamed over it, so a crash mid-write leaves the previous
 * version intact.
 * @param {string} file
 * @param {unknown} state
 */
export function writeStateFile(file, state) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(`${file}.tmp`, file);
}
