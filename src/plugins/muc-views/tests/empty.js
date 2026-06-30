import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u, stx, sizzle, Strophe } = converse.env;

describe('The MUC empty state', function () {
    it(
        'is shown in a freshly-created room and is not suppressed by the ephemeral 201 notice',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';
            const model = await mock.openAndEnterMUC(_converse, muc_jid, nick);
            const view = _converse.chatboxviews.get(muc_jid);

            // The room (whose disco features include MAM) fires off a history query
            // on entry. The empty state stays hidden until that query settles, so
            // answer it with an empty archive (no messages, complete) here.
            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const mam_iq = await u.waitUntil(() =>
                sent_IQs.filter((iq) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, iq).length).pop()
            );
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<iq type="result" id="${mam_iq.getAttribute('id')}" xmlns="jabber:client">
                        <fin xmlns="urn:xmpp:mam:2" complete="true"/>
                    </iq>`
                )
            );

            // A room we've entered with no conversation yet shows the empty state.
            await u.waitUntil(() => view.querySelector('converse-muc-empty'));
            expect(model.messages.length).toBe(0);

            // The server reports this is a brand-new room (status code 201). Converse
            // renders that as an *ephemeral* info message that self-destructs after ~10s.
            const presence = stx`
                <presence xmlns="jabber:client" to="${_converse.jid}" from="${muc_jid}/${nick}">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <status code="201"/>
                        <item role="moderator" affiliation="owner" jid="${_converse.jid}"/>
                        <status code="110"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));

            // The ephemeral 201 info message lands ...
            await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 1);
            expect(model.messages.length).toBe(1);
            const info = model.messages.at(0);
            expect(info.get('type')).toBe('info');
            expect(info.get('is_ephemeral')).toBe(true);
            expect(info.get('code')).toBe('201');

            // ... and the empty state is STILL shown, because ephemeral/info messages
            // don't count as conversation. A naive `messages.length === 0` check would
            // have hidden it here, so this assertion is the regression guard.
            expect(view.querySelector('converse-muc-empty')).not.toBe(null);

            // A real groupchat message clears the empty state.
            const msg = stx`
                <message xmlns="jabber:client"
                         from="${muc_jid}/juliet"
                         id="${u.getUniqueId()}"
                         to="${_converse.jid}"
                         type="groupchat">
                    <body>Hello world</body>
                </message>`;
            await view.model.handleMessageStanza(msg);
            await u.waitUntil(() => model.messages.filter((m) => m.get('type') === 'groupchat').length === 1);
            await u.waitUntil(() => view.querySelector('converse-muc-empty') === null);
            expect(view.querySelector('converse-muc-empty')).toBe(null);
        }),
    );
});
