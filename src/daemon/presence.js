/**
 * The `presence.*` methods: our own availability and status message. A
 * restricted connection may use them only when the config's `policy.presence`
 * allows it, since an agent changing how available we look is a claim made
 * under our name.
 * @module @converse/daemon/presence
 */
import { ERRORS, RPCError } from './protocol.js';

/** The availability values a client may set. */
export const SHOW_VALUES = ['online', 'chat', 'away', 'xa', 'dnd'];

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {import('./types').Config} deps.config
 */
export function presenceMethods(_converse, { config }) {
    const { api } = _converse;

    return {
        /**
         * Sets our availability, and optionally our status message. Without a
         * message, the one we have stays as it is.
         * @param {Object} params
         * @param {string} params.show - One of SHOW_VALUES
         * @param {string} [params.message]
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').PresenceDTO>}
         */
        async 'presence.set'({ show, message }, client) {
            if (client.access === 'restricted' && !config.policy.presence) {
                throw new RPCError(
                    ERRORS.ACCESS_DENIED,
                    'Restricted access can\'t change your presence. To allow it, set "policy.presence" to true ' +
                        `in ${config.paths.config}.`,
                );
            }
            if (!SHOW_VALUES.includes(show)) {
                throw new RPCError(ERRORS.INVALID_PARAMS, `"show" must be one of: ${SHOW_VALUES.join(', ')}.`);
            }
            if (message !== undefined && typeof message !== 'string') {
                throw new RPCError(ERRORS.INVALID_PARAMS, '"message" must be text.');
            }
            if (!api.connection.connected()) {
                throw new RPCError(
                    ERRORS.NOT_CONNECTED,
                    "The daemon is not connected to the server, so your presence wasn't changed. " +
                        'Check "converse-cli daemon status", then try again.',
                );
            }

            await api.user.status.set(show, message);
            // Report what headless made of it, which is what contacts will see.
            return {
                show: await api.user.status.get(),
                status_message: _converse.state.profile.get('status_message') || null,
            };
        },
    };
}
