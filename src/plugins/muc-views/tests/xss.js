/*global mock, converse */

const { stx, u } = converse.env;

describe("XSS", function () {
    describe("A Groupchat", function () {

        it("escapes occupant nicknames when rendering them, to avoid JS-injection attacks",
                mock.initConverse([], {}, async function (_converse) {

            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');

            const presence = stx`
                <presence xmlns="jabber:client"
                          to="romeo@montague.lit/pda"
                          from="lounge@montague.lit/&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item jid="someone@montague.lit" role="moderator"/>
                        <status code="110"/>
                    </x>
                </presence>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            await u.waitUntil(() => view.querySelectorAll('.occupant-list .occupant-nick').length === 2);
            const occupants = view.querySelectorAll('.occupant-list li .occupant-nick');
            expect(occupants.length).toBe(2);
            expect(occupants[0].textContent.trim()).toBe('<img src="x" onerror="alert(123)"/>');
        }));

        it("escapes the subject before rendering it, to avoid JS-injection attacks",
                mock.initConverse([], {}, async function (_converse) {

            await mock.openAndEnterMUC(_converse, 'jdev@conference.jabber.org', 'jc');
            spyOn(window, 'alert');
            const subject = '<img src="x" onerror="alert(\'XSS\');"/>';
            const view = _converse.chatboxviews.get('jdev@conference.jabber.org');
            view.model.set({'subject': {
                'text': subject,
                'author': 'ralphm'
            }});
            const text = await u.waitUntil(() => view.querySelector('.chat-head__desc')?.textContent.trim());
            expect(text).toBe(subject);
        }));
    });
});
