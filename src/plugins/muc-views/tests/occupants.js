/*global mock, converse */

const { $pres, sizzle, u } = converse.env;

describe("The occupants sidebar", function () {

    it("shows all members even if they're not currently present in the groupchat",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit'
        const members = [{
            'nick': 'juliet',
            'jid': 'juliet@capulet.lit',
            'affiliation': 'member'
        }];
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', [], members);
        const view = _converse.chatboxviews.get(muc_jid);
        await u.waitUntil(() => view.model.occupants.length === 2);

        const occupants = view.querySelector('.occupant-list');
        for (let i=0; i<mock.chatroom_names.length; i++) {
            const name = mock.chatroom_names[i];
            const role = mock.chatroom_roles[name].role;
            // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
            const presence = $pres({
                    to:'romeo@montague.lit/pda',
                    from:'lounge@montague.lit/'+name
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
            .c('item').attrs({
                affiliation: mock.chatroom_roles[name].affiliation,
                jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                role: role
            });
            _converse.connection._dataRecv(mock.createRequest(presence));
        }

        await u.waitUntil(() => occupants.querySelectorAll('li').length > 2, 500);
        expect(occupants.querySelectorAll('li').length).toBe(2+mock.chatroom_names.length);
        expect(view.model.occupants.length).toBe(2+mock.chatroom_names.length);

        mock.chatroom_names.forEach(name => {
            const model = view.model.occupants.findWhere({'nick': name});
            const index = view.model.occupants.indexOf(model);
            expect(occupants.querySelectorAll('li .occupant-nick')[index].textContent.trim()).toBe(name);
        });

        // Test users leaving the groupchat
        // https://xmpp.org/extensions/xep-0045.html#exit
        for (let i=mock.chatroom_names.length-1; i>-1; i--) {
            const name = mock.chatroom_names[i];
            // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
            const presence = $pres({
                to:'romeo@montague.lit/pda',
                from:'lounge@montague.lit/'+name,
                type: 'unavailable'
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
            .c('item').attrs({
                affiliation: mock.chatroom_roles[name].affiliation,
                jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                role: 'none'
            }).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(presence));
            expect(occupants.querySelectorAll('li').length).toBe(8);
        }
        const presence = $pres({
                to: 'romeo@montague.lit/pda',
                from: 'lounge@montague.lit/nonmember'
        }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
        .c('item').attrs({
            affiliation: null,
            jid: 'servant@montague.lit',
            role: 'visitor'
        });
        _converse.connection._dataRecv(mock.createRequest(presence));
        await u.waitUntil(() => occupants.querySelectorAll('li').length > 8, 500);
        expect(occupants.querySelectorAll('li').length).toBe(9);
        expect(view.model.occupants.length).toBe(9);
        expect(view.model.occupants.filter(o => o.isMember()).length).toBe(8);

        view.model.rejoin();
        // Test that members aren't removed when we reconnect
        expect(view.model.occupants.length).toBe(8);
        view.model.session.set('connection_status', converse.ROOMSTATUS.ENTERED); // Hack
        await u.waitUntil(() => view.querySelectorAll('.occupant-list li').length === 8);
    }));

    it("shows users currently present in the groupchat",
        mock.initConverse([], {}, async function (_converse) {

        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
        var view = _converse.chatboxviews.get('lounge@montague.lit');
        const occupants = view.querySelector('.occupant-list');
        for (var i=0; i<mock.chatroom_names.length; i++) {
            const name = mock.chatroom_names[i];
            // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
            const presence = $pres({
                to:'romeo@montague.lit/pda',
                from:'lounge@montague.lit/'+name
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
            .c('item').attrs({
                affiliation: 'none',
                jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                role: 'participant'
            }).up()
            .c('status');
            _converse.connection._dataRecv(mock.createRequest(presence));
        }

        await u.waitUntil(() => occupants.querySelectorAll('li').length > 1, 500);
        expect(occupants.querySelectorAll('li').length).toBe(1+mock.chatroom_names.length);

        mock.chatroom_names.forEach(name => {
            const model = view.model.occupants.findWhere({'nick': name});
            const index = view.model.occupants.indexOf(model);
            expect(occupants.querySelectorAll('li .occupant-nick')[index].textContent.trim()).toBe(name);
        });

        // Test users leaving the groupchat
        // https://xmpp.org/extensions/xep-0045.html#exit
        for (i=mock.chatroom_names.length-1; i>-1; i--) {
            const name = mock.chatroom_names[i];
            // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
            const presence = $pres({
                to:'romeo@montague.lit/pda',
                from:'lounge@montague.lit/'+name,
                type: 'unavailable'
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
            .c('item').attrs({
                affiliation: "none",
                jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                role: 'none'
            });
            _converse.connection._dataRecv(mock.createRequest(presence));
        }
        await u.waitUntil(() => occupants.querySelectorAll('li').length === 1);
    }));

    it("lets you click on an occupant to insert it into the chat textarea",
            mock.initConverse([], {'view_mode': 'fullscreen'}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        var view = _converse.chatboxviews.get(muc_jid);
        const occupants = view.querySelector('.occupant-list');
        const name = mock.chatroom_names[0];
        const presence = $pres({
            to:'romeo@montague.lit/pda',
            from:'lounge@montague.lit/'+name
        }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
        .c('item').attrs({
            affiliation: 'none',
            jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
            role: 'participant'
        }).up()
        .c('status');
        _converse.connection._dataRecv(mock.createRequest(presence));

        await u.waitUntil(() => occupants.querySelectorAll('li').length > 1, 500);
        expect(occupants.querySelectorAll('li').length).toBe(2);
        view.querySelectorAll('.occupant-nick')[1].click()

        const textarea = view.querySelector('.chat-textarea');
        expect(textarea.value).toBe('@Dyon van de Wege ');
    }));

    it("indicates moderators and visitors by means of a special css class and tooltip",
            mock.initConverse([], {'view_mode': 'fullscreen'}, async function (_converse) {

        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
        const view = _converse.chatboxviews.get('lounge@montague.lit');
        let contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        await u.waitUntil(() => view.querySelectorAll('.occupant-list li').length, 500);
        let occupants = view.querySelectorAll('.occupant-list li');
        expect(occupants.length).toBe(1);
        expect(occupants[0].querySelector('.occupant-nick').textContent.trim()).toBe("romeo");
        expect(occupants[0].querySelectorAll('.badge').length).toBe(2);
        expect(occupants[0].querySelectorAll('.badge')[0].textContent.trim()).toBe('Owner');
        expect(sizzle('.badge:last', occupants[0]).pop().textContent.trim()).toBe('Moderator');

        var presence = $pres({
                to:'romeo@montague.lit/pda',
                from:'lounge@montague.lit/moderatorman'
        }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
        .c('item').attrs({
            affiliation: 'admin',
            jid: contact_jid,
            role: 'moderator',
        }).up()
        .c('status').attrs({code:'110'}).nodeTree;

        _converse.connection._dataRecv(mock.createRequest(presence));
        await u.waitUntil(() => view.querySelectorAll('.occupant-list li').length > 1, 500);
        occupants = view.querySelectorAll('.occupant-list li');
        expect(occupants.length).toBe(2);
        expect(occupants[0].querySelector('.occupant-nick').textContent.trim()).toBe("moderatorman");
        expect(occupants[1].querySelector('.occupant-nick').textContent.trim()).toBe("romeo");
        expect(occupants[0].querySelectorAll('.badge').length).toBe(2);
        expect(occupants[0].querySelectorAll('.badge')[0].textContent.trim()).toBe('Admin');
        expect(occupants[0].querySelectorAll('.badge')[1].textContent.trim()).toBe('Moderator');

        expect(occupants[0].getAttribute('title')).toBe(
            contact_jid + ' This user is a moderator. Click to mention moderatorman in your message.'
        );

        contact_jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        presence = $pres({
            to:'romeo@montague.lit/pda',
            from:'lounge@montague.lit/visitorwoman'
        }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
        .c('item').attrs({
            jid: contact_jid,
            role: 'visitor',
        }).up()
        .c('status').attrs({code:'110'}).nodeTree;
        _converse.connection._dataRecv(mock.createRequest(presence));

        await u.waitUntil(() => view.querySelectorAll('.occupant-list li').length > 2, 500);
        occupants = view.querySelector('.occupant-list').querySelectorAll('li');
        expect(occupants.length).toBe(3);
        expect(occupants[2].querySelector('.occupant-nick').textContent.trim()).toBe("visitorwoman");
        expect(occupants[2].querySelectorAll('.badge').length).toBe(1);
        expect(sizzle('.badge', occupants[2]).pop().textContent.trim()).toBe('Visitor');
        expect(occupants[2].getAttribute('title')).toBe(
            contact_jid + ' This user can NOT send messages in this groupchat. Click to mention visitorwoman in your message.'
        );
    }));
});
