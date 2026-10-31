/**
 * Answers the IQs a daemon on the MockConnection sends that a real server
 * would answer on its own: service discovery, including that of the rooms on
 * the MUC service, their member lists, and MAM queries against an archive the
 * spec supplies. What it doesn't answer, a spec answers itself.
 */
import { converse } from '@converse/headless';

const { Strophe, stx } = converse.env;

const NS_MAM = 'urn:xmpp:mam:2';
const NS_RSM = 'http://jabber.org/protocol/rsm';
const NS_FULLTEXT = 'urn:xmpp:fulltext:0';
/** What `respond` returns for an IQ the server never answers: it times out. */
const TIMED_OUT = Symbol('timed out');

/**
 * @param {Object} options
 * @param {import('@converse/headless').MockConnection} options.connection
 * @param {(stanza: import('strophe.js').Builder) => void} options.receive
 * @param {string} options.jid - Our full JID
 * @param {string[]} [options.server_features] - What the server's disco#info lists
 * @param {{ id: string, from: string, to: string, body: string, time: string }[]} [options.archive]
 *  Messages in our account's archive, oldest first, each with the stanza-id the archive
 *  assigned it. If given, our account supports MAM.
 * @param {boolean} [options.fulltext] - Whether the archive offers full-text search (XEP-0431), which
 *  matches each word of the text case-insensitively in a message's body. Defaults to true.
 * @param {'answer'|'error'|'silent'} [options.mam_mode] - How MAM queries are answered: with the
 *  archive, with an error, or not at all (so that they time out). Can be changed with `setMAMMode`.
 * @param {{ jid: string, put_url: string, get_url: string, max_file_size: number }} [options.upload_service]
 */
export function serve({
    connection,
    receive,
    jid,
    server_features = [],
    archive,
    mam_mode = 'answer',
    fulltext = true,
    upload_service,
}) {
    const bare_jid = Strophe.getBareJidFromJid(jid);
    const domain = Strophe.getDomainFromJid(jid);
    const muc_domain = `conference.${domain}`;
    const account_features = archive ? [NS_MAM, ...(fulltext ? [NS_FULLTEXT] : [])] : [];
    /** Every MAM query received, for specs to assert on. */
    const mam_queries = [];
    let current_mam_mode = mam_mode;

    /**
     * @param {Element} iq
     * @returns {import('strophe.js').Builder|typeof TIMED_OUT|null} The response, or TIMED_OUT,
     *  or null to leave it unanswered.
     */
    function respond(iq) {
        const to = iq.getAttribute('to');
        const id = iq.getAttribute('id');
        const disco_info = iq.querySelector(`query[xmlns="${Strophe.NS.DISCO_INFO}"]`);
        const disco_items = iq.querySelector(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"]`);

        if (disco_info && (to === domain || to === bare_jid)) {
            const [identity, advertised_features] =
                to === domain ? [['server', 'im'], server_features] : [['account', 'registered'], account_features];
            let features = advertised_features;
            if (to === domain && upload_service) features = [...features, Strophe.NS.DISCO_ITEMS];
            return stx`
                <iq xmlns="jabber:client" type="result" from="${to}" to="${jid}" id="${id}">
                    <query xmlns="${Strophe.NS.DISCO_INFO}">
                        <identity category="${identity[0]}" type="${identity[1]}"/>
                        ${features.map((f) => stx`<feature var="${f}"/>`)}
                    </query>
                </iq>`;
        }
        if (disco_info && to === upload_service?.jid) {
            return stx`
                <iq xmlns="jabber:client" type="result" from="${to}" to="${jid}" id="${id}">
                    <query xmlns="${Strophe.NS.DISCO_INFO}">
                        <identity category="store" type="file" name="HTTP File Upload"/>
                        <feature var="${Strophe.NS.HTTPUPLOAD}"/>
                        <x xmlns="jabber:x:data" type="result">
                            <field var="FORM_TYPE" type="hidden"><value>${Strophe.NS.HTTPUPLOAD}</value></field>
                            <field var="max-file-size"><value>${upload_service.max_file_size}</value></field>
                        </x>
                    </query>
                </iq>`;
        }
        if (disco_info && Strophe.getDomainFromJid(to) === muc_domain && Strophe.getNodeFromJid(to)) {
            // Every room asked about exists. Whether it lets us in is up to the spec.
            return stx`
                <iq xmlns="jabber:client" type="result" from="${to}" to="${jid}" id="${id}">
                    <query xmlns="${Strophe.NS.DISCO_INFO}">
                        <identity category="conference" type="text"/>
                        <feature var="${Strophe.NS.MUC}"/>
                        <feature var="${Strophe.NS.OCCUPANTID}"/>
                    </query>
                </iq>`;
        }
        if (iq.querySelector(`query[xmlns="${Strophe.NS.MUC_ADMIN}"]`) && Strophe.getDomainFromJid(to) === muc_domain) {
            // Asked for its members, a room lists none.
            return stx`
                <iq xmlns="jabber:client" type="result" from="${to}" to="${jid}" id="${id}">
                    <query xmlns="${Strophe.NS.MUC_ADMIN}"/>
                </iq>`;
        }
        if (disco_items && to === domain) {
            return stx`
                <iq xmlns="jabber:client" type="result" from="${to}" to="${jid}" id="${id}">
                    <query xmlns="${Strophe.NS.DISCO_ITEMS}">
                        ${upload_service ? stx`<item jid="${upload_service.jid}" name="HTTP File Upload"/>` : ''}
                    </query>
                </iq>`;
        }
        const slot_request = iq.querySelector(`request[xmlns="${Strophe.NS.HTTPUPLOAD}"]`);
        if (slot_request && to === upload_service?.jid) {
            return stx`
                <iq xmlns="jabber:client" type="result" from="${to}" to="${jid}" id="${id}">
                    <slot xmlns="${Strophe.NS.HTTPUPLOAD}">
                        <put url="${upload_service.put_url}"/>
                        <get url="${upload_service.get_url}"/>
                    </slot>
                </iq>`;
        }
        const mam = iq.querySelector(`query[xmlns="${NS_MAM}"]`);
        if (mam && archive && !to) {
            mam_queries.push(mam);
            if (current_mam_mode === 'silent') return TIMED_OUT;
            if (current_mam_mode === 'error') {
                return stx`
                    <iq xmlns="jabber:client" type="error" to="${jid}" id="${id}">
                        <error type="cancel">
                            <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                        </error>
                    </iq>`;
            }
            answerMAM(mam, id);
            return null;
        }
        return null;
    }

    /**
     * Sends the matching page of the archive, newest last, then the <fin/>.
     * @param {Element} query
     * @param {string} iq_id
     */
    function answerMAM(query, iq_id) {
        const field = (name) => query.querySelector(`x field[var="${name}"] value`)?.textContent ?? undefined;
        const rsm = (name) => query.querySelector(`set[xmlns="${NS_RSM}"] > ${name}`)?.textContent;
        const [with_jid, start, end] = [field('with'), field('start'), field('end')];
        const words = (field(`{${NS_FULLTEXT}}fulltext`) ?? '').toLowerCase().split(/\s+/).filter(Boolean);
        const max = Number(rsm('max') ?? 50);
        const before = rsm('before');

        let matches = archive.filter(
            (m) =>
                (!with_jid || m.from === with_jid || m.to === with_jid) &&
                (!start || m.time >= start) &&
                (!end || m.time <= end) &&
                words.every((word) => m.body.toLowerCase().includes(word)),
        );
        if (before)
            matches = matches.slice(
                0,
                matches.findIndex((m) => m.id === before),
            );
        // Without an `after`, every query here pages backwards: the newest `max`.
        const page = matches.slice(-max);

        page.forEach((m) =>
            receive(stx`
                <message xmlns="jabber:client" to="${jid}">
                    <result xmlns="${NS_MAM}" queryid="${query.getAttribute('queryid')}" id="${m.id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="${m.time}"/>
                            <message xmlns="jabber:client" from="${m.from}" to="${m.to}" type="chat">
                                <body>${m.body}</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`),
        );
        receive(stx`
            <iq xmlns="jabber:client" type="result" to="${jid}" id="${iq_id}">
                <fin xmlns="${NS_MAM}" complete="${page.length === matches.length}">
                    <set xmlns="${NS_RSM}">
                        ${page.length ? stx`<first>${page[0].id}</first>` : ''}
                        ${page.length ? stx`<last>${page.at(-1).id}</last>` : ''}
                        <count>${matches.length}</count>
                    </set>
                </fin>
            </iq>`);
    }

    // IQs sent before we got here (during login) are answered now, later ones
    // as they go out.
    // The mock's own timers don't run Strophe's IQ timeouts, so a silent
    // server is played here: the errback gets null, as Strophe would give it.
    const answer = (iq, errback) => {
        const response = respond(iq);
        if (response === TIMED_OUT) errback?.(null);
        else if (response) receive(response);
    };
    connection.IQ_stanzas.slice().forEach((iq) => answer(iq));
    const send = connection.sendIQ.bind(connection);
    connection.sendIQ = (iq, callback, errback) => {
        const id = send(iq, callback, errback);
        const el = iq.tree?.() ?? iq;
        setTimeout(() => answer(el, errback));
        return id;
    };

    return {
        mam_queries,
        /** @param {'answer'|'error'|'silent'} mode */
        setMAMMode(mode) {
            current_mam_mode = mode;
        },
    };
}
