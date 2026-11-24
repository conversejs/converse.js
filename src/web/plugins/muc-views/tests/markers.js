import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u, stx } = converse.env;

// See: https://xmpp.org/rfcs/rfc3921.html

describe('A XEP-0333 Chat Marker', function () {
    it(
        'may be returned for a MUC message',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await mock.setComposerText(view, 'But soft, what light through yonder airlock breaks?');
            await mock.pressComposerKey(view, 'Enter');
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.querySelector('.chat-msg .chat-msg__text').textContent.trim()).toBe(
                'But soft, what light through yonder airlock breaks?',
            );

            const msg_obj = view.model.messages.at(0);
            let stanza = stx`
            <message xml:lang="en" to="romeo@montague.lit/orchard"
                     from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                <received xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
            </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);
            expect(view.querySelectorAll('.chat-msg__receipt').length).toBe(0);

            stanza = stx`
            <message xml:lang="en" to="romeo@montague.lit/orchard"
                     from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                <displayed xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
            </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.querySelectorAll('.chat-msg__receipt').length).toBe(0);

            stanza = stx`
            <message xml:lang="en" to="romeo@montague.lit/orchard"
                     from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                <acknowledged xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
            </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.querySelectorAll('.chat-msg__receipt').length).toBe(0);

            stanza = stx`
            <message xml:lang="en" to="romeo@montague.lit/orchard"
                     from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                <body>'tis I!</body>
                <stanza-id xmlns='urn:xmpp:sid:0' id='stanza-id-1' by='${muc_jid}'/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
            </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);
            expect(view.querySelectorAll('.chat-msg__receipt').length).toBe(0);
        }),
    );
});
