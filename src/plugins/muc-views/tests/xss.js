/*global mock, converse */

const $pres = converse.env.$pres;
const u = converse.env.utils;

describe("XSS", function () {
    describe("A Groupchat", function () {

        it("escapes occupant nicknames when rendering them, to avoid JS-injection attacks",
                mock.initConverse([], {}, async function (_converse) {

            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            /* <presence xmlns="jabber:client" to="jc@chat.example.org/converse.js-17184538"
             *      from="oo@conference.chat.example.org/&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;">
             *   <x xmlns="http://jabber.org/protocol/muc#user">
             *    <item jid="jc@chat.example.org/converse.js-17184538" affiliation="owner" role="moderator"/>
             *    <status code="110"/>
             *   </x>
             * </presence>"
             */
            const presence = $pres({
                    to:'romeo@montague.lit/pda',
                    from:"lounge@montague.lit/&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;"
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    jid: 'someone@montague.lit',
                    role: 'moderator',
                }).up()
                .c('status').attrs({code:'110'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            await u.waitUntil(() => view.querySelectorAll('.occupant-list .occupant-nick').length === 2);
            const occupants = view.querySelectorAll('.occupant-list li .occupant-nick');
            expect(occupants.length).toBe(2);
            expect(occupants[0].textContent.trim()).toBe("&lt;img src=&quot;x&quot; onerror=&quot;alert(123)&quot;/&gt;");
        }));

        it("escapes the subject before rendering it, to avoid JS-injection attacks",
                mock.initConverse([], {}, async function (_converse) {

            await mock.openAndEnterChatRoom(_converse, 'jdev@conference.jabber.org', 'jc');
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
