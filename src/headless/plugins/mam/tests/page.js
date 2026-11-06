import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Strophe, stx } = converse.env;
const NS_RSM = 'http://jabber.org/protocol/rsm';

/**
 * Messages from `from` to us, one a minute, with ids "m1", "m2", ...
 * @param {string} from
 * @param {number} count
 */
function archiveOf(from, count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `m${i + 1}`,
        from,
        body: `Message ${i + 1}`,
        time: new Date(Date.UTC(2026, 9, 1, 10, i)).toISOString(),
    }));
}

/**
 * @param {Element} iq
 * @returns {Element|undefined} The archive query the IQ makes, if it makes one
 */
const mamQueryOf = (iq) => iq.getElementsByTagNameNS(Strophe.NS.MAM, 'query')[0];

/**
 * Answers every MAM query with the newest page of `archive` that matches it,
 * and records the queries answered.
 * @param {Object} _converse
 * @param {ReturnType<typeof archiveOf>} archive
 */
function serveArchive(_converse, archive) {
    const connection = _converse.api.connection.get();
    const { jid } = connection;
    const queries = [];

    const answer = (iq) => {
        const query = mamQueryOf(iq);
        const field = (name) => query.querySelector(`x field[var="${name}"] value`)?.textContent;
        const rsm = (name) => query.getElementsByTagNameNS(NS_RSM, 'set')[0]?.querySelector(name)?.textContent;
        const end = field('end');
        const before = rsm('before');

        let matches = archive.filter((m) => !end || m.time <= end);
        if (before)
            matches = matches.slice(
                0,
                matches.findIndex((m) => m.id === before),
            );
        const page = matches.slice(-Number(rsm('max') ?? 50));

        const receive = (stanza) => connection._dataRecv(mock.createRequest(_converse, stanza));
        page.forEach((m) =>
            receive(stx`
                <message xmlns="jabber:client" from="${_converse.bare_jid}" to="${jid}">
                    <result xmlns="${Strophe.NS.MAM}" queryid="${query.getAttribute('queryid')}" id="${m.id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="${m.time}"/>
                            <message xmlns="jabber:client" from="${m.from}" to="${_converse.bare_jid}" type="chat">
                                <body>${m.body}</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`),
        );
        receive(stx`
            <iq xmlns="jabber:client" type="result" to="${jid}" id="${iq.getAttribute('id')}">
                <fin xmlns="${Strophe.NS.MAM}" complete="${page.length === matches.length}">
                    <set xmlns="${NS_RSM}">
                        ${page.length ? stx`<first>${page[0].id}</first>` : ''}
                        ${page.length ? stx`<last>${page.at(-1).id}</last>` : ''}
                        <count>${matches.length}</count>
                    </set>
                </fin>
            </iq>`);
    };

    // Each query is answered once, in the order sent, until the connection goes.
    const timer = setInterval(() => {
        if (!_converse.api.connection.connected()) return clearInterval(timer);

        connection.IQ_stanzas.filter((iq) => mamQueryOf(iq) && !queries.includes(iq)).forEach((iq) => {
            queries.push(iq);
            answer(iq);
        });
    }, 10);
    return queries;
}

/**
 * Opens a chat with a contact, its archive served from `archive`.
 * @param {Object} _converse
 * @param {number} count - How many messages the archive has
 */
async function openChat(_converse, count) {
    const { api } = _converse;
    await mock.waitForRoster(_converse, 'current');
    await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    const queries = serveArchive(_converse, archiveOf(contact_jid, count));
    const chat = await api.chats.get(contact_jid, {}, true);
    await chat.messages.fetched;
    return { chat, queries };
}

const bodies = (messages) => messages.map((m) => m.get('body'));

describe('The archive.page API', function () {
    it(
        'pages back into the archive until the page is full, and stops asking once it runs out',
        mock.initConverse(converse, ['discoInitialized'], { archived_messages_page_size: '3' }, async (_converse) => {
            const { api } = _converse;
            const { chat, queries } = await openChat(_converse, 5);

            const page = await api.archive.page(chat, { limit: 4 });
            expect(bodies(page)).toEqual(['Message 2', 'Message 3', 'Message 4', 'Message 5']);

            expect(bodies(await api.archive.page(chat, { limit: 10 }))).toEqual([
                'Message 1',
                'Message 2',
                'Message 3',
                'Message 4',
                'Message 5',
            ]);

            const asked = queries.length;
            expect(bodies(await api.archive.page(chat, { limit: 10 }))).toHaveSize(5);
            expect(queries.length).toBe(asked);
        }),
    );

    it(
        'ends before a given message, leaves out older than "since", and counts only what the filter lets in',
        mock.initConverse(converse, ['discoInitialized'], { archived_messages_page_size: '10' }, async (_converse) => {
            const { api } = _converse;
            const { chat } = await openChat(_converse, 6);
            await api.archive.page(chat, { limit: 10 });

            const m5 = chat.messages.findWhere({ body: 'Message 5' });
            expect(bodies(await api.archive.page(chat, { limit: 2, before: m5 }))).toEqual(['Message 3', 'Message 4']);

            const since = Date.UTC(2026, 9, 1, 10, 3);
            expect(bodies(await api.archive.page(chat, { limit: 10, since }))).toEqual([
                'Message 4',
                'Message 5',
                'Message 6',
            ]);

            const filter = (m) => m.get('body') !== 'Message 5';
            expect(bodies(await api.archive.page(chat, { limit: 2, filter }))).toEqual(['Message 4', 'Message 6']);
        }),
    );
});
