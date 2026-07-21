import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u, stx } = converse.env;

describe('XEP-0461 Message Replies', function () {
    describe('A Chat Message', function () {
        it(
            'can be replied to using a message action',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const firstMessageText = 'But soft, what light through yonder airlock breaks?';

            await mock.setComposerText(view, firstMessageText);
                await mock.pressComposerKey(view, 'Enter');
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

                // Click the reply button
                const replyAction = view.querySelector('.chat-msg__action-reply');
                expect(replyAction).not.toBeNull();
                replyAction.click();

                // Check that the reply state is set on the chatbox
                const chatbox = view.model;
                expect(chatbox.get('reply_to_id')).toBeDefined();
                expect(chatbox.get('reply_to')).toBeDefined();

                // Check that the reply preview is shown
                await u.waitUntil(() => view.querySelector('.reply-preview'));
                const replyPreview = view.querySelector('.reply-preview');
                expect(replyPreview).not.toBeNull();
                expect(replyPreview.querySelector('.reply-preview__text').textContent).toContain(firstMessageText);
            }),
        );

        it(
            'can cancel a reply in progress',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const firstMessageText = 'Hello world';

            await mock.setComposerText(view, firstMessageText);
                await mock.pressComposerKey(view, 'Enter');
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

                // Click the reply button
                const replyAction = view.querySelector('.chat-msg__action-reply');
                replyAction.click();

                await u.waitUntil(() => view.querySelector('.reply-preview'));

                // Click the cancel button
                const cancelButton = view.querySelector('.reply-preview__cancel');
                expect(cancelButton).not.toBeNull();
                cancelButton.click();

                // Check that the reply state is cleared
                const chatbox = view.model;
                await u.waitUntil(() => chatbox.get('reply_to_id') === undefined);
                expect(chatbox.get('reply_to')).toBeUndefined();

                // Check that the reply preview is hidden
                await u.waitUntil(() => !view.querySelector('.reply-preview'));
            }),
        );

        it(
            'includes reply element in outgoing stanza when replying',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // Send a message first
                const firstMessageText = 'Original message';
            await mock.setComposerText(view, firstMessageText);
                await mock.pressComposerKey(view, 'Enter');
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

                // Click reply
                const replyAction = view.querySelector('.chat-msg__action-reply');
                replyAction.click();
                await u.waitUntil(() => view.querySelector('.reply-preview'));

                // Send a reply
                let sent_stanzas = [];
                const send = api.connection.get().send;
                spyOn(api.connection.get(), 'send').and.callFake((stanza) => {
                    sent_stanzas.push(stanza);
                    return send.call(api.connection.get(), stanza);
                });

            await mock.setComposerText(view, 'This is my reply');
                await mock.pressComposerKey(view, 'Enter');

                await u.waitUntil(() => sent_stanzas.length === 1);

                // Check that the sent stanza includes the reply element
                const sent_stanza = sent_stanzas[0];
                const reply_el = sent_stanza.querySelector('reply');
                expect(reply_el).not.toBeNull();
                expect(reply_el.getAttribute('xmlns')).toBe('urn:xmpp:reply:0');
                expect(reply_el.getAttribute('id')).toBeDefined();
            }),
        );

        it(
            'parses incoming reply messages correctly',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                // First send a message to reply to
                const original_id = u.getUniqueId();
                const original_stanza = stx`
                <message xmlns="jabber:client"
                    from="${contact_jid}"
                    to="${api.connection.get().jid}"
                    type="chat"
                    id="${original_id}">
                    <body>Original message</body>
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                </message>
            `;
                _converse.handleMessageStanza(original_stanza);
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

                // Now send a reply message
                const reply_stanza = stx`
                <message xmlns="jabber:client"
                    from="${contact_jid}"
                    to="${api.connection.get().jid}"
                    type="chat"
                    id="${u.getUniqueId()}">
                    <body>This is a reply</body>
                    <reply xmlns="urn:xmpp:reply:0" id="${original_id}" to="${api.connection.get().jid}"/>
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                </message>
            `;

                _converse.handleMessageStanza(reply_stanza);
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);

                // Check that the reply context is displayed
                await u.waitUntil(() => view.querySelector('converse-reply-context'));
                const replyContext = view.querySelector('converse-reply-context');
                expect(replyContext).not.toBeNull();
            }),
        );

        it(
            'includes a XEP-0461 fallback body quoting the original message',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

            await mock.setComposerText(view, 'Original message');
                await mock.pressComposerKey(view, 'Enter');
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

                view.querySelector('.chat-msg__action-reply').click();
                await u.waitUntil(() => view.querySelector('.reply-preview'));

                const sent_stanzas = [];
                const send = api.connection.get().send;
                spyOn(api.connection.get(), 'send').and.callFake((stanza) => {
                    sent_stanzas.push(stanza);
                    return send.call(api.connection.get(), stanza);
                });

                const reply_text = 'This is my reply';
            await mock.setComposerText(view, reply_text);
                await mock.pressComposerKey(view, 'Enter');
                await u.waitUntil(() => sent_stanzas.length === 1);

                const sent_stanza = sent_stanzas[0];
                // The body carries the quoted original as a XEP-0393 quote, then the reply text.
                const body = sent_stanza.querySelector('body').textContent;
                expect(body.startsWith('> ')).toBe(true);
                expect(body).toContain('> Original message');
                expect(body.endsWith(reply_text)).toBe(true);

                // The structured <reply> is still sent...
                expect(sent_stanza.querySelector('reply').getAttribute('xmlns')).toBe('urn:xmpp:reply:0');
                // ...and a XEP-0428 <fallback> marks the quoted code-point range.
                const fallback = sent_stanza.querySelector('fallback');
                expect(fallback.getAttribute('xmlns')).toBe('urn:xmpp:fallback:0');
                expect(fallback.getAttribute('for')).toBe('urn:xmpp:reply:0');
                const fb_body = fallback.querySelector('body');
                expect(Number(fb_body.getAttribute('start'))).toBe(0);
                expect(Number(fb_body.getAttribute('end'))).toBe([...body].length - [...reply_text].length);

                // The stored message strips the fallback for display.
                expect(view.model.messages.last().getMessageText()).toBe(reply_text);
            }),
        );

        it(
            'truncates a long quoted original in the XEP-0461 fallback body',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const long_original =
                    'But soft, what light through yonder airlock breaks? It is the east and Juliet is the sun, arise fair sun';
            await mock.setComposerText(view, long_original);
                await mock.pressComposerKey(view, 'Enter');
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

                view.querySelector('.chat-msg__action-reply').click();
                await u.waitUntil(() => view.querySelector('.reply-preview'));

                const sent_stanzas = [];
                const send = api.connection.get().send;
                spyOn(api.connection.get(), 'send').and.callFake((stanza) => {
                    sent_stanzas.push(stanza);
                    return send.call(api.connection.get(), stanza);
                });

                const reply_text = 'Indeed it does';
            await mock.setComposerText(view, reply_text);
                await mock.pressComposerKey(view, 'Enter');
                await u.waitUntil(() => sent_stanzas.length === 1);

                const sent_stanza = sent_stanzas[0];
                const body = sent_stanza.querySelector('body').textContent;

                // The quoted original is truncated to 80 code points + an ellipsis;
                // the tail beyond that is dropped, but the reply text is intact.
                expect(body).toContain('> But soft, what light through yonder');
                expect(body).toContain('…');
                expect(body).not.toContain('arise fair sun');
                expect(body.endsWith(reply_text)).toBe(true);

                // The XEP-0428 marker covers exactly the (truncated) quote range,
                // and the displayed text strips it.
                const fb_body = sent_stanza.querySelector('fallback body');
                expect(Number(fb_body.getAttribute('end'))).toBe([...body].length - [...reply_text].length);
                expect(view.model.messages.last().getMessageText()).toBe(reply_text);
            }),
        );

        it(
            'strips the reply fallback from the displayed body on receive',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                const original_id = u.getUniqueId();
                _converse.handleMessageStanza(stx`<message xmlns="jabber:client"
                        from="${contact_jid}" to="${api.connection.get().jid}" type="chat" id="${original_id}">
                    <body>Original message</body>
                </message>`);
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

                const quote = '> Juliet:\n> Original message\n';
                const reply_body = quote + 'This is a reply';
                _converse.handleMessageStanza(stx`<message xmlns="jabber:client"
                        from="${contact_jid}" to="${api.connection.get().jid}" type="chat" id="${u.getUniqueId()}">
                    <body>${reply_body}</body>
                    <reply xmlns="urn:xmpp:reply:0" id="${original_id}" to="${api.connection.get().jid}"/>
                    <fallback xmlns="urn:xmpp:fallback:0" for="urn:xmpp:reply:0"><body start="0" end="${[...quote].length}"/></fallback>
                </message>`);
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);

                // The reply context is rendered, and the quoted fallback is stripped from the body.
                await u.waitUntil(() => view.querySelector('converse-reply-context'));
                const reply_msg = view.model.messages.last();
                expect(reply_msg.getMessageText()).toBe('This is a reply');
                const text_el = Array.from(view.querySelectorAll('.chat-msg__text')).pop();
                expect(text_el.textContent.includes('Original message')).toBe(false);
                expect(text_el.textContent).toContain('This is a reply');
            }),
        );
    });
});
