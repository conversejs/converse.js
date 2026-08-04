/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Behavioural tests for the XEP-0147 dispatch (../xmpp-uri-dispatch.js). The
 * dispatcher isn't exported from the bundle and binds the bundle's own `api`
 * singleton, so it's exercised the way a user reaches it: by clicking a rendered
 * `xmpp:` link in a message. The link's href is rewritten to the exact URI under
 * test just before the click, which isolates the dispatch logic from the message
 * linkifier (the click handler reads `currentTarget.href`).
 */
import mock from './mock.js';
import converse from '../../../dist/converse.js';

const { u, Strophe, sizzle, stx } = converse.env;

/**
 * Render a handled `xmpp:` link in a 1:1 chat and point it at `href`, WITHOUT
 * clicking it (so a test can set up state, e.g. a draft, before the click).
 * @param {any} _converse
 * @param {string} href
 */
async function renderXMPPURI(_converse, href) {
    await mock.waitForRoster(_converse, 'current');
    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    const view = _converse.chatboxviews.get(contact_jid);

    // A handled xmpp: URI in the body so the texture renderer attaches the in-app
    // click handler; the href is rewritten below to the precise URI under test.
    _converse.handleMessageStanza(stx`<message
            from="${contact_jid}"
            to="${_converse.api.connection.get().jid}"
            type="chat"
            id="${u.getUniqueId()}"
            xmlns="jabber:client">
        <body>xmpp:someone@montague.lit?join</body>
    </message>`);

    const link = await u.waitUntil(() => view.querySelector('.chat-msg__text a'));
    link.href = href;
    return link;
}

/**
 * Render a handled `xmpp:` link in a 1:1 chat, point it at `href`, and click it.
 * @param {any} _converse
 * @param {string} href
 */
async function clickXMPPURI(_converse, href) {
    const link = await renderXMPPURI(_converse, href);
    link.click();
    return link;
}

describe('The XEP-0147 xmpp: URI dispatcher', function () {
    it(
        'message action opens the composer seeded with the body as a draft (no confirm when empty)',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            spyOn(api, 'confirm').and.callFake(() => Promise.resolve(true));
            // The target chat isn't open (no draft to lose), so seeding is silent.
            await clickXMPPURI(_converse, 'xmpp:mercutio@montague.lit?message;body=Hello%20there');
            const chat = await u.waitUntil(() => _converse.chatboxes.get('mercutio@montague.lit'));
            await u.waitUntil(() => chat.get('draft') === 'Hello there');
            expect(chat.get('draft')).toBe('Hello there');
            expect(api.confirm).not.toHaveBeenCalled();
        }),
    );

    it(
        'message action replaces an unsent draft after the clobber is confirmed',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            const jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const link = await renderXMPPURI(_converse, `xmpp:${jid}?message;body=New%20message`);
            _converse.chatboxes.get(jid).set('draft', 'half-typed');

            spyOn(api, 'confirm').and.callFake(() => Promise.resolve(true));
            link.click();
            await u.waitUntil(() => _converse.chatboxes.get(jid).get('draft') === 'New message');
            expect(api.confirm).toHaveBeenCalled();
        }),
    );

    it(
        'message action keeps the unsent draft when the clobber is cancelled',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            const jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const link = await renderXMPPURI(_converse, `xmpp:${jid}?message;body=New%20message`);
            _converse.chatboxes.get(jid).set('draft', 'half-typed');

            spyOn(api, 'confirm').and.callFake(() => Promise.resolve(false));
            link.click();
            await u.waitUntil(() => api.confirm.calls.count() === 1);
            expect(_converse.chatboxes.get(jid).get('draft')).toBe('half-typed');
        }),
    );

    it(
        'roster action adds a contact (without a subscription) after confirmation',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            spyOn(api, 'confirm').and.callFake(() => Promise.resolve(true));
            await clickXMPPURI(_converse, 'xmpp:someone@montague.lit?roster;name=Someone;group=Friends');
            expect(api.confirm).toHaveBeenCalled();

            const { IQ_stanzas } = api.connection.get();
            const iq = await u.waitUntil(() =>
                IQ_stanzas.find(
                    (iq) =>
                        sizzle(
                            `iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"] item[jid="someone@montague.lit"]`,
                            iq,
                        ).length,
                ),
            );
            const item = iq.querySelector('item');
            expect(item.getAttribute('name')).toBe('Someone');
            expect(item.querySelector('group').textContent).toBe('Friends');
        }),
    );

    it(
        'roster action is a no-op when the confirmation is cancelled',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            spyOn(api, 'confirm').and.callFake(() => Promise.resolve(false));
            await clickXMPPURI(_converse, 'xmpp:someone@montague.lit?roster');
            await u.waitUntil(() => api.confirm.calls.count() === 1);

            const { IQ_stanzas } = api.connection.get();
            expect(IQ_stanzas.some((iq) => sizzle('item[jid="someone@montague.lit"]', iq).length)).toBe(false);
        }),
    );

    it(
        'subscribe action sends a presence subscription after confirmation',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            spyOn(api, 'confirm').and.callFake(() => Promise.resolve(true));
            // A JID already in the roster takes the `subscribeToPresence` branch,
            // which sends the subscribe presence deterministically.
            const target = mock.cur_names[2].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await clickXMPPURI(_converse, `xmpp:${target}?subscribe`);

            const { sent_stanzas } = api.connection.get();
            const pres = await u.waitUntil(() =>
                sent_stanzas.find(
                    (s) => s.matches?.('presence[type="subscribe"]') && s.getAttribute('to') === target,
                ),
            );
            expect(pres).toBeDefined();
        }),
    );

    it(
        'remove action removes the contact from the roster after confirmation',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            spyOn(api, 'confirm').and.callFake(() => Promise.resolve(true));
            const target = mock.cur_names[1].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await clickXMPPURI(_converse, `xmpp:${target}?remove`);
            expect(api.confirm).toHaveBeenCalled();

            // The roster-remove IQ is the deterministic effect; whether an
            // unsubscribe/unsubscribed presence also goes out depends on the
            // contact's subscription state, which isn't what this asserts.
            const { IQ_stanzas } = api.connection.get();
            const iq = await u.waitUntil(() =>
                IQ_stanzas.find((iq) => sizzle(`item[jid="${target}"][subscription="remove"]`, iq).length),
            );
            expect(iq).toBeDefined();
        }),
    );

    it(
        'unsubscribe action sends an unsubscribe presence after confirmation',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            spyOn(api, 'confirm').and.callFake(() => Promise.resolve(true));
            await clickXMPPURI(_converse, 'xmpp:someone@montague.lit?unsubscribe');

            const { sent_stanzas } = api.connection.get();
            const pres = await u.waitUntil(() =>
                sent_stanzas.find(
                    (s) =>
                        s.matches?.('presence[type="unsubscribe"]') &&
                        s.getAttribute('to') === 'someone@montague.lit',
                ),
            );
            expect(pres).toBeDefined();
        }),
    );
});
