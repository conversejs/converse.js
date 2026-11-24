import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u, stx } = converse.env;

describe('A link in a chat message', function () {
    /** @type {MouseEvent[]} */
    let followed;

    /**
     * Records the clicks that reach the document without being prevented, which
     * are the ones the browser would follow, and stops it from following them.
     * @param {MouseEvent} ev
     */
    function onDocumentClick(ev) {
        if (ev.defaultPrevented) return;
        followed.push(ev);
        ev.preventDefault();
    }

    beforeEach(() => {
        followed = [];
        document.addEventListener('click', onDocumentClick);
    });

    afterEach(() => {
        document.removeEventListener('click', onDocumentClick);
        vi.restoreAllMocks();
    });

    /**
     * @param {any} _converse
     * @param {import('lit').TemplateResult|any} payload - The children of the incoming <message>
     * @returns {Promise<HTMLElement>} The open chat
     */
    async function receiveMessage(_converse, payload) {
        await mock.waitForRoster(_converse, 'current');
        const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        _converse.handleMessageStanza(stx`<message
                from="${contact_jid}"
                to="${_converse.api.connection.get().jid}"
                type="chat"
                id="${u.getUniqueId()}"
                xmlns="jabber:client">${payload}</message>`);
        return _converse.chatboxviews.get(contact_jid);
    }

    /**
     * @param {HTMLElement} link
     * @param {MouseEventInit} [click_init]
     */
    function click(link, click_init = {}) {
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...click_init }));
    }

    it(
        'asks before it is followed out of the chat',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const confirm = vi.spyOn(_converse.api, 'confirm').mockResolvedValue(false);
            const view = await receiveMessage(_converse, stx`<body>Look at https://example.org/page</body>`);
            const link = await u.waitUntil(() => view.querySelector('.chat-msg__text a'));

            click(link);
            await u.waitUntil(() => confirm.mock.calls.length);
            expect(confirm).toHaveBeenCalledWith('Open external link?', [
                'This link will take you to example.org',
                'https://example.org/page',
            ]);
            await new Promise((resolve) => setTimeout(resolve));
            expect(followed).toEqual([]);
        }),
    );

    it(
        'opens in a new tab once confirmed',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            vi.spyOn(_converse.api, 'confirm').mockResolvedValue(true);
            const open = vi.spyOn(window, 'open').mockReturnValue(null);
            const view = await receiveMessage(_converse, stx`<body>Look at https://example.org/page</body>`);
            const link = await u.waitUntil(() => view.querySelector('.chat-msg__text a'));

            click(link);
            await u.waitUntil(() => open.mock.calls.length);
            expect(open).toHaveBeenCalledWith('https://example.org/page', '_blank', 'noopener');
            expect(followed).toEqual([]);
        }),
    );

    it(
        'opens the page of an invitation link that was clicked with a modifier key',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            // Ctrl-click asks for the invitation page rather than the chat, so the
            // link is external, and confirming it mustn't open the chat after all.
            vi.spyOn(_converse.api, 'confirm').mockResolvedValue(true);
            const open = vi.spyOn(window, 'open').mockReturnValue(null);
            const url = 'https://xmpp.link/#tybalt@montague.lit';
            const view = await receiveMessage(_converse, stx`<body>${url}</body>`);
            const link = await u.waitUntil(() => view.querySelector('.chat-msg__text a'));

            click(link, { ctrlKey: true });
            await u.waitUntil(() => open.mock.calls.length);
            expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener');
            expect(_converse.chatboxes.get('tybalt@montague.lit')).toBeUndefined();
        }),
    );

    it(
        'asks before a file attachment is downloaded from elsewhere',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const confirm = vi.spyOn(_converse.api, 'confirm').mockResolvedValue(false);
            const url = 'https://example.org/report.pdf';
            const view = await receiveMessage(
                _converse,
                stx`<body>${url}</body><x xmlns="jabber:x:oob"><url>${url}</url></x>`,
            );
            const link = await u.waitUntil(() => view.querySelector(`.chat-msg__content a[href="${url}"]`));

            click(link);
            await u.waitUntil(() => confirm.mock.calls.length);
            expect(confirm.mock.calls[0][1]).toEqual(['This link will take you to example.org', url]);
            expect(followed).toEqual([]);
        }),
    );

    it(
        "doesn't ask before an xmpp: link that Converse opens itself",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const confirm = vi.spyOn(_converse.api, 'confirm');
            const view = await receiveMessage(_converse, stx`<body>xmpp:tybalt@montague.lit</body>`);
            const link = await u.waitUntil(() => view.querySelector('.chat-msg__text a'));

            click(link);
            await u.waitUntil(() => _converse.chatboxes.get('tybalt@montague.lit'));
            expect(followed).toEqual([]);
            expect(confirm).not.toHaveBeenCalled();
        }),
    );

    it(
        'asks before a middle-click opens it in a new tab',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const confirm = vi.spyOn(_converse.api, 'confirm').mockResolvedValue(false);
            const view = await receiveMessage(_converse, stx`<body>Look at https://example.org/page</body>`);
            const link = await u.waitUntil(() => view.querySelector('.chat-msg__text a'));

            const ev = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });
            link.dispatchEvent(ev);
            expect(ev.defaultPrevented).toBe(true);
            await u.waitUntil(() => confirm.mock.calls.length);
        }),
    );

    it(
        'opens a shift-clicked link in a new window once confirmed',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            vi.spyOn(_converse.api, 'confirm').mockResolvedValue(true);
            const open = vi.spyOn(window, 'open').mockReturnValue(null);
            const view = await receiveMessage(_converse, stx`<body>Look at https://example.org/page</body>`);
            const link = await u.waitUntil(() => view.querySelector('.chat-msg__text a'));

            click(link, { shiftKey: true });
            await u.waitUntil(() => open.mock.calls.length);
            expect(open).toHaveBeenCalledWith('https://example.org/page', '_blank', 'noopener,popup');
        }),
    );

    it(
        'asks before a link to another page on the same site',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            // Such as an open redirect, which leads anywhere.
            const confirm = vi.spyOn(_converse.api, 'confirm').mockResolvedValue(false);
            const url = `${location.origin}/redirect?to=https://example.org`;
            const view = await receiveMessage(_converse, stx`<body>${url}</body>`);
            const link = await u.waitUntil(() => view.querySelector('.chat-msg__text a'));

            click(link);
            await u.waitUntil(() => confirm.mock.calls.length);
            expect(followed).toEqual([]);
        }),
    );

    it(
        "doesn't ask before a link to the page Converse runs on",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const confirm = vi.spyOn(_converse.api, 'confirm');
            const url = `${location.origin}${location.pathname}${location.search}#converse`;
            const view = await receiveMessage(_converse, stx`<body>${url}</body>`);
            const link = await u.waitUntil(() => view.querySelector('.chat-msg__text a'));

            click(link);
            expect(followed.length).toBe(1);
            expect(confirm).not.toHaveBeenCalled();
        }),
    );

    it(
        "doesn't ask before a link that opens another app",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const confirm = vi.spyOn(_converse.api, 'confirm');
            // An xmpp: action Converse doesn't handle, so it's left to the OS.
            const view = await receiveMessage(
                _converse,
                stx`<body>Mail mailto:romeo@montague.lit or see xmpp:romeo@montague.lit?vcard</body>`,
            );
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text a').length === 2);

            view.querySelectorAll('.chat-msg__text a').forEach((link) => click(/** @type {HTMLElement} */ (link)));
            expect(followed.length).toBe(2);
            expect(confirm).not.toHaveBeenCalled();
        }),
    );

    it(
        "doesn't ask when confirm_external_links is off",
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { confirm_external_links: false },
            async function (_converse) {
                const confirm = vi.spyOn(_converse.api, 'confirm');
                const view = await receiveMessage(_converse, stx`<body>Look at https://example.org/page</body>`);
                const link = await u.waitUntil(() => view.querySelector('.chat-msg__text a'));

                click(link);
                expect(followed.length).toBe(1);
                expect(confirm).not.toHaveBeenCalled();
            },
        ),
    );
});
