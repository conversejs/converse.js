/**
 * Which methods each access level may call.
 * @module @converse/daemon/access
 */

/**
 * The access each method needs, for every method the daemon serves:
 *
 * - `restricted`: either level. What a restricted connection may then do,
 *   such as whom it may send to, is up to the send policy.
 * - `full`: the user's own access. Stopping the daemon, sending or dropping
 *   drafts, sending or discarding a failed send again, and trusting a device.
 * - `drafts`: full access, and restricted access in "as_user" mode too. There
 *   the drafts wait in the daemon, so the agent may see which are still
 *   waiting, but not send or drop them.
 *
 * A method that isn't listed here keeps the daemon from starting (see
 * {@link checkMethodAccess}), rather than being open to restricted connections.
 * @type {Record<string, 'restricted'|'full'|'drafts'>}
 */
const METHOD_ACCESS = {
    'contacts.list': 'restricted',
    'contacts.whois': 'restricted',
    'conversations.list': 'restricted',
    'daemon.status': 'restricted',
    'daemon.stop': 'full',
    'drafts.get': 'drafts',
    'drafts.list': 'drafts',
    'drafts.reject': 'full',
    'drafts.send': 'full',
    'events.subscribe': 'restricted',
    'events.unsubscribe': 'restricted',
    'files.upload': 'restricted',
    'inbox.read': 'restricted',
    'messages.discard': 'full',
    'messages.list': 'restricted',
    'messages.react': 'restricted',
    'messages.resend': 'full',
    'messages.retract': 'restricted',
    'messages.search': 'restricted',
    'messages.send': 'restricted',
    'omemo.devices.list': 'restricted',
    'omemo.devices.trust': 'full',
    'presence.set': 'restricted',
    'rooms.discover': 'restricted',
    'rooms.join': 'restricted',
    'rooms.leave': 'restricted',
    'rooms.occupants': 'restricted',
    'schedules.cancel': 'restricted',
    'schedules.create': 'restricted',
    'schedules.list': 'restricted',
};

/**
 * Whether a connection at this access level may call the method, in this mode.
 * A method with no access listed may not be called at all.
 * @param {string} method
 * @param {import('./types').Access} access
 * @param {import('./types').Mode} mode
 */
export function mayCall(method, access, mode) {
    const needs = Object.hasOwn(METHOD_ACCESS, method) ? METHOD_ACCESS[method] : null;
    if (needs === null) return false;
    if (access === 'full') return true;

    return needs === 'restricted' || (needs === 'drafts' && mode === 'as_user');
}

/**
 * Refuses a set of methods that has one without an access level listed.
 * @param {string[]} methods
 */
export function checkMethodAccess(methods) {
    const unlisted = methods.filter((method) => !Object.hasOwn(METHOD_ACCESS, method));
    if (unlisted.length) {
        throw new Error(`No access level is listed for ${unlisted.join(', ')}. Add it to METHOD_ACCESS in access.js.`);
    }
}
