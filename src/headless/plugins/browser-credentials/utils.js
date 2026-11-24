import log from '@converse/log';
import { getRememberedSession } from '../../utils/remembered-session.js';
import { isSameBareJID, isValidJID } from '../../utils/jid.js';
import { IS_BROWSER } from '../../utils/environment.js';

/**
 * Whether the browser exposes the Credential Management API.
 * @returns {boolean}
 */
export function hasCredentialsAPI() {
    return IS_BROWSER && 'credentials' in navigator;
}

/**
 * Reads a password from the browser's credential store.
 * @param {boolean} silent - Whether to only take a password that the browser
 *  hands over without asking the user.
 * @returns {Promise<import('../../utils/types').Credentials|null>}
 */
async function readPassword(silent) {
    try {
        const creds = /** @type {Credential & { password?: string }} */ (
            await navigator.credentials.get(
                /** @type {CredentialRequestOptions} */ ({
                    password: true,
                    ...(silent ? { mediation: 'silent' } : {}),
                }),
            )
        );
        if (creds?.type === 'password' && creds.password && isValidJID(creds.id)) {
            return { jid: creds.id, password: creds.password };
        }
    } catch (e) {
        log.error(e);
    }
    return null;
}

/**
 * Gets the password of the remembered account, if the browser hands it over
 * without asking.
 * @param {string} jid - The remembered account's bare JID
 * @returns {Promise<import('../../utils/types').Credentials|null>}
 */
async function getUnattendedCredentials(jid) {
    const credentials = await readPassword(true);
    return credentials && isSameBareJID(credentials.jid, jid) ? credentials : null;
}

/**
 * Gets a password from the browser, which may ask the user to pick one. Only
 * asked for an account that this device remembers, so that a first visit
 * doesn't bring up the browser's prompt.
 * @returns {Promise<import('../../utils/types').Credentials|null>}
 */
async function getPromptedCredentials() {
    if (!(await getRememberedSession())) return null;

    // Not compared with the remembered account, since the user may have
    // picked another one from the browser's list.
    return readPassword(false);
}

/**
 * Supplies a password from the browser's credential store to log in with.
 * @param {unknown} _context
 * @param {import('../../utils/types').FallbackCredentialsHookPayload} payload
 * @returns {Promise<import('../../utils/types').FallbackCredentialsHookPayload>}
 */
export async function getLoginCredentials(_context, payload) {
    if (payload.credentials) return payload;
    // Only browsers that store passwords for sites have any to hand over.
    if (!('PasswordCredential' in window)) return payload;

    const credentials = payload.unattended
        ? await getUnattendedCredentials(payload.jid)
        : await getPromptedCredentials();
    return credentials ? { ...payload, credentials } : payload;
}
