/**
 * The account's password, for the daemon's login, and the passwords of the
 * rooms it joins. Only the daemon imports this: a client never touches them.
 * @module @converse/daemon/secrets
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { parseRooms } from './config.js';

/**
 * The account password: from the config file if it has one, otherwise from
 * the system keyring (libsecret's `secret-tool` on Linux, `security` on
 * macOS), under service "converse" and the bare JID as account. The file is
 * read again here, rather than kept in the loaded config, so that the
 * password goes no further than the login.
 * @param {import('./types').Config} config
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<string>}
 */
export async function getPassword(config, env = process.env) {
    const { password: in_file } = JSON.parse(fs.readFileSync(config.paths.config, 'utf8'));
    if (typeof in_file === 'string' && in_file) return in_file;

    const [cmd, args, store_hint] =
        process.platform === 'darwin'
            ? [
                  'security',
                  ['find-generic-password', '-s', 'converse', '-a', config.jid, '-w'],
                  `security add-generic-password -s converse -a ${config.jid} -w`,
              ]
            : [
                  'secret-tool',
                  ['lookup', 'service', 'converse', 'account', config.jid],
                  `secret-tool store --label=Converse service converse account ${config.jid}`,
              ];
    try {
        const { stdout } = await promisify(execFile)(cmd, args, { env });
        const password = stdout.replace(/\n$/, '');
        if (password) return password;
    } catch {
        // Not installed, or no such entry: both end in the error below.
    }
    throw new Error(
        `No password for ${config.jid}. Store one in the system keyring with "${store_hint}", ` +
            `or set "password" in ${config.paths.config}.`,
    );
}

/**
 * The passwords of the rooms that have one under "rooms" in the config file,
 * by room JID. Read from the file, as the account password is, so that they
 * stay out of the loaded config, and checked again, since the file may have
 * changed since {@link loadConfig} read it.
 * @param {import('./types').Config} config
 * @returns {Map<string, string>}
 */
export function getRoomPasswords(config) {
    const { rooms } = JSON.parse(fs.readFileSync(config.paths.config, 'utf8'));
    return parseRooms(rooms, config.paths.config).passwords;
}
