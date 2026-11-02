import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { CodedError, StanzaError, TimeoutError } from '../../shared/errors.js';
import { parseErrorStanza } from '../../shared/parsers.js';
import { RSM } from '../../shared/rsm.js';

const { Strophe, sizzle, stx, u } = converse.env;

Strophe.addNamespace('CHANNEL_SEARCH', 'urn:xmpp:channel-search:0:search');
Strophe.addNamespace('CHANNEL_SEARCH_PARAMS', 'urn:xmpp:channel-search:0:search-params');
Strophe.addNamespace('CHANNEL_SEARCH_ORDER', 'urn:xmpp:channel-search:0:order');
Strophe.addNamespace('CHANNEL_SEARCH_ERROR', 'urn:xmpp:channel-search:0:error');
// The protocol search.jabber.network spoke before it was standardised as XEP-0433
Strophe.addNamespace('MUCLUMBUS_SEARCH', 'https://xmlns.zombofant.net/muclumbus/search/1.0');

// How long to wait after a service first rate-limits us without saying for how long,
// or doesn't respond. Doubled each further time, up to the maximum.
const DEFAULT_RETRY_AFTER_SECONDS = 30;
const MAX_RETRY_AFTER_SECONDS = 15 * 60;

/**
 * Thrown instead of searching when we know a search service won't answer:
 * its `code` says why, and `retry_after` from when it may answer again.
 */
export class ChannelSearchRefusedError extends CodedError {
    /**
     * @param {import('./types').ChannelSearchRefusal} code
     * @param {string} service
     * @param {Date} [retry_after]
     */
    constructor(code, service, retry_after) {
        super(
            code,
            retry_after
                ? `Not searching ${service} until ${retry_after.toISOString()}: ${code}`
                : `Not searching ${service}: ${code}`,
        );
        this.name = 'ChannelSearchRefusedError';
        this.service = service;
        this.retry_after = retry_after;
    }
}

/**
 * Which protocol each search service turned out to speak, or 'none' if it rejected both.
 * Services don't necessarily advertise XEP-0433 via disco, so we find out by trying.
 * @type {Map<string, import('./types').ChannelSearchProtocol | 'none'>}
 */
const protocols = new Map();

/**
 * The services we're not querying for now, because they rate-limited us or didn't respond.
 * @type {Map<string, import('./types').ChannelSearchBackOff>}
 */
const back_offs = new Map();

export function clearSearchState() {
    protocols.clear();
    back_offs.clear();
}

/**
 * Stops querying a service for a while. Without a time given by the service,
 * the wait doubles each time until a search succeeds again.
 * @param {string} service
 * @param {import('./types').ChannelSearchBackOff['reason']} reason
 * @param {number} [seconds]
 */
function backOff(service, reason, seconds) {
    const attempts = (back_offs.get(service)?.attempts ?? 0) + 1;
    const delay = seconds ?? Math.min(DEFAULT_RETRY_AFTER_SECONDS * 2 ** (attempts - 1), MAX_RETRY_AFTER_SECONDS);
    back_offs.set(service, { reason, attempts, until: Date.now() + delay * 1000 });
}

/**
 * @param {import('./types').ChannelSearchProtocol} protocol
 * @param {string} service
 * @param {string} query
 * @param {import('./types').ChannelSearchOptions} options
 */
function buildSearchIQ(protocol, service, query, options) {
    const { max, after, sort } = options;
    const rsm = stx`<set xmlns="${Strophe.NS.RSM}">
        <max>${String(max)}</max>
        ${after ? stx`<after>${after}</after>` : ''}
    </set>`;

    if (protocol === 'xep-0433') {
        const sort_key = `{${Strophe.NS.CHANNEL_SEARCH_ORDER}}${sort}`;
        return stx`
            <iq type="get" to="${service}" id="${u.getUniqueId('search')}" xmlns="jabber:client">
                <search xmlns="${Strophe.NS.CHANNEL_SEARCH}">
                    ${rsm}
                    <x xmlns="${Strophe.NS.XFORM}" type="submit">
                        <field var="FORM_TYPE" type="hidden">
                            <value>${Strophe.NS.CHANNEL_SEARCH_PARAMS}</value>
                        </field>
                        <field var="q" type="text-single"><value>${query}</value></field>
                        <field var="sinname" type="boolean"><value>true</value></field>
                        <field var="sindescription" type="boolean"><value>true</value></field>
                        <field var="sinaddr" type="boolean"><value>true</value></field>
                        <field var="types" type="list-multi"><value>xep-0045</value></field>
                        <field var="key" type="list-single"><value>${sort_key}</value></field>
                    </x>
                </search>
            </iq>`;
    }
    return stx`
        <iq type="get" to="${service}" id="${u.getUniqueId('search')}" xmlns="jabber:client">
            <search xmlns="${Strophe.NS.MUCLUMBUS_SEARCH}">
                ${rsm}
                <x xmlns="${Strophe.NS.XFORM}" type="submit">
                    <field var="FORM_TYPE" type="hidden"><value>${Strophe.NS.MUCLUMBUS_SEARCH}#params</value></field>
                    <field var="q" type="text-single"><value>${query}</value></field>
                    <field var="sinname" type="boolean"><value>true</value></field>
                    <field var="sindescription" type="boolean"><value>true</value></field>
                    <field var="sinaddress" type="boolean"><value>true</value></field>
                    <field var="min_users" type="text-single"><value>1</value></field>
                    <field var="key" type="list-single"><value>${sort}</value></field>
                </x>
            </search>
        </iq>`;
}

/**
 * @param {Element} iq
 * @param {string} xmlns
 * @returns {import('./types').ChannelSearchResult}
 */
function parseSearchResult(iq, xmlns) {
    const result = sizzle(`result[xmlns="${xmlns}"]`, iq).pop();
    if (!result) return { items: [] };

    const items = Array.from(result.querySelectorAll(':scope > item'))
        .filter((item) => item.getAttribute('address'))
        .map((item) => {
            /** @param {string} name */
            const text = (name) => item.querySelector(`:scope > ${name}`)?.textContent.trim() || undefined;
            const nusers = parseInt(text('nusers'), 10);
            const is_open = item.querySelector(':scope > is-open');
            return {
                jid: item.getAttribute('address'),
                name: text('name'),
                description: text('description'),
                language: text('language'),
                nusers: Number.isNaN(nusers) ? undefined : nusers,
                // Defined as boolean character data, but in practice sent as an empty flag element
                is_open: is_open ? !['false', '0'].includes(is_open.textContent.trim()) : undefined,
                anonymity_mode: text('anonymity-mode'),
                service_type: text('service-type'),
            };
        });

    const set = sizzle(`> set[xmlns="${Strophe.NS.RSM}"]`, result).pop();
    const { last } = set ? new RSM({ xml: set }).result : {};
    // An empty <last/> isn't a cursor, and would make the next request fetch the first page again
    return { items, last: last || undefined };
}

/**
 * Whether an error from a XEP-0433 request means the service doesn't speak
 * XEP-0433 at all, as opposed to the service rejecting this particular search.
 * @param {Error} err
 */
function isUnsupported(err) {
    if (!(err instanceof StanzaError)) return false;
    if (err.extra?.[Strophe.NS.CHANNEL_SEARCH_ERROR]) return false;
    return ['service-unavailable', 'feature-not-implemented'].includes(err.name);
}

/**
 * @param {string} service
 * @param {Error} err
 */
function maybeBackOff(service, err) {
    if (!(err instanceof StanzaError)) return;
    if (err.extra?.[Strophe.NS.CHANNEL_SEARCH_ERROR] !== 'rate-limit') return;

    const el = sizzle(`rate-limit[xmlns="${Strophe.NS.CHANNEL_SEARCH_ERROR}"]`, err.el).pop();
    const seconds = parseInt(el?.getAttribute('retry-after'), 10);
    backOff(service, 'rate-limited', Number.isNaN(seconds) ? undefined : seconds);
}

/**
 * @param {import('./types').ChannelSearchProtocol} protocol
 * @param {string} service
 * @param {string} query
 * @param {import('./types').ChannelSearchOptions} options
 * @returns {Promise<import('./types').ChannelSearchResult>}
 */
async function sendSearch(protocol, service, query, options) {
    const iq = await api.sendIQ(buildSearchIQ(protocol, service, query, options), undefined, false);
    if (iq === null) {
        throw new TimeoutError(`Timeout while searching for channels on ${service}`);
    }
    const err = await parseErrorStanza(iq);
    if (err) throw err;

    const xmlns = protocol === 'xep-0433' ? Strophe.NS.CHANNEL_SEARCH : Strophe.NS.MUCLUMBUS_SEARCH;
    return parseSearchResult(iq, xmlns);
}

/**
 * @param {string} service
 * @param {string} query
 * @param {import('./types').ChannelSearchOptions} options
 * @returns {Promise<import('./types').ChannelSearchResult>}
 */
async function searchChannels(service, query, options) {
    const back_off = back_offs.get(service);
    if (back_off?.until > Date.now()) {
        throw new ChannelSearchRefusedError(back_off.reason, service, new Date(back_off.until));
    }

    const known = protocols.get(service);
    if (known === 'none') {
        throw new ChannelSearchRefusedError('unsupported', service);
    }

    const protocol = known ?? 'xep-0433';
    let xep_0433_error;
    try {
        const result = await sendSearch(protocol, service, query, options);
        protocols.set(service, protocol);
        back_offs.delete(service);
        return result;
    } catch (e) {
        maybeBackOff(service, e);
        if (protocol !== 'xep-0433') throw e;
        // A service that doesn't know XEP-0433 might not answer at all
        if (!isUnsupported(e) && !(e instanceof TimeoutError)) throw e;

        xep_0433_error = e;
    }

    try {
        const result = await sendSearch('muclumbus', service, query, options);
        protocols.set(service, 'muclumbus');
        back_offs.delete(service);
        return result;
    } catch (e) {
        if (isUnsupported(e) && isUnsupported(xep_0433_error)) {
            protocols.set(service, 'none');
        } else if (e instanceof TimeoutError || xep_0433_error instanceof TimeoutError) {
            // Not necessarily permanent, so try again later instead of giving up on the service
            backOff(service, 'unresponsive');
        }
        throw e;
    }
}

/**
 * Records XEP-0433's application-specific error conditions on parsed errors.
 * @param {Element} stanza
 * @param {import('../../shared/types').ErrorExtra} extra
 */
export function parseChannelSearchError(stanza, extra) {
    const el = sizzle(`error [xmlns="${Strophe.NS.CHANNEL_SEARCH_ERROR}"]`, stanza).pop();
    return el ? { ...extra, [Strophe.NS.CHANNEL_SEARCH_ERROR]: el.nodeName } : extra;
}

export default {
    /**
     * Searches for public groupchats across servers, using a XEP-0433
     * Extended Channel Search service such as search.jabber.network.
     *
     * Falls back to the pre-standard protocol of that service when the
     * service doesn't speak XEP-0433.
     *
     * @method api.rooms.search
     * @param {string} query - Keywords to look for in the names, descriptions and addresses of groupchats
     * @param {import('./types').ChannelSearchOptions} [options]
     * @returns {Promise<import('./types').ChannelSearchResult>}
     * @throws {ChannelSearchRefusedError} Without querying, when the search service
     *  rate-limited us or didn't respond recently, or supports neither protocol.
     * @throws {Error} When no search service is configured, or the search service
     *  returns an error.
     *
     * @example
     * const { items, last } = await api.rooms.search('xmpp');
     * // Fetch the next page
     * const next = await api.rooms.search('xmpp', { after: last });
     */
    async search(query, options = {}) {
        const service = options.service ?? api.settings.get('muc_search_service');
        if (!service) throw new Error('rooms.search: No search service configured');

        return await searchChannels(service, query, {
            ...options,
            max: options.max ?? 10,
            sort: options.sort ?? 'nusers',
        });
    },
};
