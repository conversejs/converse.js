/**
 * The `contacts.*` methods: the roster, and what's known about a JID. They
 * only read, so restricted connections may call them.
 * @module @converse/daemon/contacts
 */
import { ERRORS, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';
import { TIMED_OUT, withTimeout } from './timeout.js';

/**
 * How long a resource gets to answer disco#info before it's reported without
 * identities. A resource that's gone quiet mustn't hold up the whole lookup.
 */
const DISCO_TIMEOUT = 5000;

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 */
export function contactMethods(_converse) {
    const { api } = _converse;

    return {
        /**
         * The roster, by name, with a query matching a contact's name or JID
         * ignoring case. The names come from the contacts, so they're untrusted.
         * @param {Object} [params]
         * @param {string} [params.query]
         * @returns {Promise<{ contacts: import('./types').ContactSummary[] }>}
         */
        async 'contacts.list'({ query } = {}) {
            if (query !== undefined && typeof query !== 'string') {
                throw new RPCError(ERRORS.INVALID_PARAMS, '"query" must be text.');
            }
            const wanted = (query ?? '').trim().toLowerCase();
            const contacts = (await api.contacts.get()).map(toContactSummary);
            const matching = contacts.filter(({ jid, name }) => `${name ?? ''} ${jid}`.toLowerCase().includes(wanted));
            matching.sort((a, b) => (a.name ?? a.jid).localeCompare(b.name ?? b.jid));
            return { contacts: matching };
        },

        /**
         * Everything known about a contact: their vCard, and each client they're
         * connected with, with the identities that client advertises. A JID that
         * isn't on the roster is accepted too, and `on_roster` says which it is.
         * @param {Object} params
         * @param {string} params.jid - A JID, or a contact's name
         * @returns {Promise<import('./types').ContactDetails>}
         */
        async 'contacts.whois'({ jid }) {
            const bare_jid = await resolveJID(_converse, jid, 'jid');
            const contact = _converse.state.roster.get(bare_jid);
            const presence = _converse.state.presences?.get(bare_jid);
            const [vcard, resources] = await Promise.all([
                fetchVCard(bare_jid),
                Promise.all(
                    (presence?.resources.models ?? []).map(async (resource) => ({
                        name: resource.get('name'),
                        presence: resource.get('show') || resource.get('presence') || 'offline',
                        priority: resource.get('priority') ?? 0,
                        status: resource.get('status') ?? null,
                        identities: await discoIdentities(`${bare_jid}/${resource.get('name')}`),
                    })),
                ),
            ]);
            return {
                jid: bare_jid,
                name: contact?.getDisplayName({ no_jid: true }) ?? vcard?.fullname ?? null,
                on_roster: !!contact,
                presence: contact?.presence?.getStatus() ?? 'offline',
                vcard,
                resources,
            };
        },
    };

    /** @param {string} jid */
    async function fetchVCard(jid) {
        try {
            const result = await api.vcard.get(jid);
            if (!result || result.vcard_error) return null;
            return {
                fullname: result.fullname ?? null,
                nickname: result.nickname ?? null,
                email: result.email ?? null,
                url: result.url ?? null,
                role: result.role ?? null,
            };
        } catch {
            return null;
        }
    }

    /**
     * The identities a client advertises, asking it with disco#info if we
     * haven't already. A client that doesn't answer has none.
     * @param {string} full_jid
     */
    async function discoIdentities(full_jid) {
        const entity = await api.disco.entities.get(full_jid, true);
        if (!entity) return [];
        const answered = await withTimeout(entity.waitUntilFeaturesDiscovered, DISCO_TIMEOUT);
        if (answered === TIMED_OUT) return [];
        return entity.identities.models.map((identity) => ({
            category: identity.get('category'),
            type: identity.get('type'),
            name: identity.get('name') ?? null,
        }));
    }
}

/**
 * @param {import('@converse/headless').RosterContact} contact
 * @returns {import('./types').ContactSummary}
 */
export function toContactSummary(contact) {
    return {
        jid: contact.get('jid'),
        name: contact.getDisplayName({ no_jid: true }) ?? null,
        presence: contact.presence?.getStatus() ?? 'offline',
    };
}
