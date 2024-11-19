/*global mock, converse */
const { u, $msg } = converse.env;

describe("A Chat Message", function () {

    it("has a default avatar with a XEP-0392 color and initials",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        const textarea = view.querySelector('textarea.chat-textarea');
        const firstMessageText = 'But soft, what light through yonder airlock breaks?';

        textarea.value = firstMessageText;
        const message_form = view.querySelector('converse-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

        let el = view.querySelector('converse-chat-message converse-avatar .avatar-initials');
        expect(el.textContent).toBe('RM');
        expect(getComputedStyle(el).backgroundColor).toBe('rgb(198, 84, 0)');

        // Test messages from other user
        const secondMessageText = 'Hello';
        _converse.handleMessageStanza(
            $msg({
                'from': contact_jid,
                'to': api.connection.get().jid,
                'type': 'chat',
                'id': u.getUniqueId()
            }).c('body').t(secondMessageText).up()
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
        );
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);

        el = view.querySelector(
            `converse-chat-message div[data-from="${contact_jid}"] converse-avatar .avatar-initials`
        );
        expect(el.textContent).toBe('M');
        expect(getComputedStyle(el).backgroundColor).toBe('rgb(195, 0, 249)');

        // Change contact nickname and see that it reflects
        const contact = await api.contacts.get(contact_jid);
        contact.set('nickname', 'Wizzard');

        await u.waitUntil(() => el.textContent === 'W');

        // Change own nickname and see that it reflects
        const own_jid = _converse.session.get('jid');
        const { xmppstatus } = _converse.state;

        xmppstatus.vcard.set('fullname', 'Restless Romeo');
        el = view.querySelector(
            `converse-chat-message div[data-from="${own_jid}"] converse-avatar .avatar-initials`
        );
        await u.waitUntil(() => el.textContent === 'RR');
        expect(getComputedStyle(el).backgroundColor).toBe('rgb(198, 84, 0)');

        // eslint-disable-next-line max-len
        const image = 'PD94bWwgdmVyc2lvbj0iMS4wIj8+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiA8cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzU1NSIvPgogPGNpcmNsZSBjeD0iNjQiIGN5PSI0MSIgcj0iMjQiIGZpbGw9IiNmZmYiLz4KIDxwYXRoIGQ9Im0yOC41IDExMiB2LTEyIGMwLTEyIDEwLTI0IDI0LTI0IGgyMyBjMTQgMCAyNCAxMiAyNCAyNCB2MTIiIGZpbGw9IiNmZmYiLz4KPC9zdmc+Cg==';
        const image_type = 'image/svg+xml';

        // Change contact avatar and check that it reflects
        contact.vcard.set({
            image,
            image_type,
            vcard_updated: (new Date()).toISOString()
        });
        el = await u.waitUntil(() => view.querySelector(
            `converse-chat-message div[data-from="${contact_jid}"] converse-avatar svg image`
        ));
        expect(el.getAttribute('href')).toBe(`data:image/svg+xml;base64,${image}`);

        // Change contact avatar and check that it reflects
        xmppstatus.vcard.set({
            image,
            image_type,
            vcard_updated: (new Date()).toISOString()
        });
        el = await u.waitUntil(() => view.querySelector(
            `converse-chat-message div[data-from="${own_jid}"] converse-avatar svg image`
        ));
        expect(el.getAttribute('href')).toBe(`data:image/svg+xml;base64,${image}`);
    }));
});
