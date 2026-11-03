/**
 * Looks up the group the config's `socket_group` names.
 * @module @converse/daemon/groups
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const GROUP_ID = /^\s*\d+\s*$/;

/**
 * The id of the group the config's `socket_group` names: a number as is, a
 * name looked up in the system's group database.
 * @param {string} group
 * @returns {Promise<number>}
 */
export async function getGroupId(group) {
    if (GROUP_ID.test(group)) return Number(group);

    const [cmd, args] =
        process.platform === 'darwin'
            ? ['dscl', ['.', '-read', `/Groups/${group}`, 'PrimaryGroupID']]
            : ['getent', ['group', group]];
    let stdout = '';
    try {
        ({ stdout } = await promisify(execFile)(cmd, args));
    } catch {
        // No such group: the error below.
    }
    // getent prints "name:x:gid:members", dscl "PrimaryGroupID: gid".
    const gid = process.platform === 'darwin' ? stdout.split(':')[1] : stdout.split(':')[2];
    if (!GROUP_ID.test(gid ?? '')) {
        throw new Error(`"socket_group" names the group "${group}", which doesn't exist.`);
    }
    return Number(gid);
}
