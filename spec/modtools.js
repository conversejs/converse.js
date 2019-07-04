(function (root, factory) {
    define(["jasmine", "mock", "test-utils" ], factory);
} (this, function (jasmine, mock, test_utils) {
    const _ = converse.env._;
    const $iq = converse.env.$iq;
    const sizzle = converse.env.sizzle;
    const Strophe = converse.env.Strophe;
    const u = converse.env.utils;

    describe("The groupchat moderator tool", function () {

        it("allows you to set affiliations and roles",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            spyOn(_converse.ChatRoomView.prototype, 'showModeratorToolsModal').and.callThrough();
            const muc_jid = 'lounge@montague.lit';

            let members = [
                {'jid': 'hag66@shakespeare.lit', 'nick': 'witch', 'affiliation': 'member'},
                {'jid': 'gower@shakespeare.lit', 'nick': 'gower', 'affiliation': 'member'},
                {'jid': 'wiccarocks@shakespeare.lit', 'nick': 'wiccan', 'affiliation': 'admin'},
                {'jid': 'crone1@shakespeare.lit', 'nick': 'thirdwitch', 'affiliation': 'owner'},
                {'jid': 'romeo@montague.lit', 'nick': 'romeo', 'affiliation': 'owner'},
            ];
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo', [], members);
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => (view.model.occupants.length === 5));

            const textarea = view.el.querySelector('.chat-textarea');
            textarea.value = '/modtools';
            const enter = { 'target': textarea, 'preventDefault': function preventDefault () {}, 'keyCode': 13 };
            view.onKeyDown(enter);
            await u.waitUntil(() => view.showModeratorToolsModal.calls.count());

            const modal = view.modtools_modal;
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            let tab = modal.el.querySelector('#affiliations-tab');
            // Clear so that we don't match older stanzas
            _converse.connection.IQ_stanzas = [];
            tab.click();
            let select = modal.el.querySelector('.select-affiliation');
            expect(select.value).toBe('admin');
            let button = modal.el.querySelector('.btn-primary[name="users_with_affiliation"]');
            button.click();
            await u.waitUntil(() => !modal.loading_users_with_affiliation);
            let user_els = modal.el.querySelectorAll('.list-group--users > li');
            expect(user_els.length).toBe(1);
            expect(user_els[0].querySelector('.list-group-item.active').textContent.trim()).toBe('JID: wiccarocks@shakespeare.lit');
            expect(user_els[0].querySelector('.list-group-item:nth-child(2n)').textContent.trim()).toBe('Nickname: wiccan');
            expect(user_els[0].querySelector('.list-group-item:nth-child(3n) div').textContent.trim()).toBe('Affiliation: admin');

            _converse.connection.IQ_stanzas = [];
            select.value = 'owner';
            button.click();
            await u.waitUntil(() => !modal.loading_users_with_affiliation);
            user_els = modal.el.querySelectorAll('.list-group--users > li');
            expect(user_els.length).toBe(2);
            expect(user_els[0].querySelector('.list-group-item.active').textContent.trim()).toBe('JID: romeo@montague.lit');
            expect(user_els[0].querySelector('.list-group-item:nth-child(2n)').textContent.trim()).toBe('Nickname: romeo');
            expect(user_els[0].querySelector('.list-group-item:nth-child(3n) div').textContent.trim()).toBe('Affiliation: owner');

            expect(user_els[1].querySelector('.list-group-item.active').textContent.trim()).toBe('JID: crone1@shakespeare.lit');
            expect(user_els[1].querySelector('.list-group-item:nth-child(2n)').textContent.trim()).toBe('Nickname: thirdwitch');
            expect(user_els[1].querySelector('.list-group-item:nth-child(3n) div').textContent.trim()).toBe('Affiliation: owner');

            const toggle = user_els[1].querySelector('.list-group-item:nth-child(3n) .toggle-form');
            const form = user_els[1].querySelector('.list-group-item:nth-child(3n) .affiliation-form');
            expect(u.hasClass('hidden', form)).toBeTruthy();
            toggle.click();
            expect(u.hasClass('hidden', form)).toBeFalsy();
            select = form.querySelector('.select-affiliation');
            expect(select.value).toBe('owner');
            select.value = 'admin';
            const input = form.querySelector('input[name="reason"]');
            input.value = "You're an admin now";
            const submit = form.querySelector('.btn-primary');
            submit.click();

            spyOn(_converse.ChatRoomOccupants.prototype, 'fetchMembers').and.callThrough();
            const sent_IQ = _converse.connection.IQ_stanzas.pop();
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${sent_IQ.getAttribute('id')}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item affiliation="admin" jid="crone1@shakespeare.lit">`+
                            `<reason>You&apos;re an admin now</reason>`+
                        `</item>`+
                    `</query>`+
                `</iq>`);

            _converse.connection.IQ_stanzas = [];
            const stanza = $iq({
                'type': 'result',
                'id': sent_IQ.getAttribute('id'),
                'from': view.model.get('jid'),
                'to': _converse.connection.jid
            });
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => view.model.occupants.fetchMembers.calls.count());

            members = [
                {'jid': 'hag66@shakespeare.lit', 'nick': 'witch', 'affiliation': 'member'},
                {'jid': 'gower@shakespeare.lit', 'nick': 'gower', 'affiliation': 'member'},
                {'jid': 'wiccarocks@shakespeare.lit', 'nick': 'wiccan', 'affiliation': 'admin'},
                {'jid': 'crone1@shakespeare.lit', 'nick': 'thirdwitch', 'affiliation': 'admin'},
                {'jid': 'romeo@montague.lit', 'nick': 'romeo', 'affiliation': 'owner'},
            ];
            await test_utils.returnMemberLists(_converse, muc_jid, members);
            await u.waitUntil(() => view.model.occupants.pluck('affiliation').filter(o => o === 'owner').length === 1);
            const alert = modal.el.querySelector('.alert-primary');
            expect(alert.textContent.trim()).toBe('Affiliation changed');

            user_els = modal.el.querySelectorAll('.list-group--users > li');
            expect(user_els.length).toBe(1);
            expect(user_els[0].querySelector('.list-group-item.active').textContent.trim()).toBe('JID: romeo@montague.lit');
            expect(user_els[0].querySelector('.list-group-item:nth-child(2n)').textContent.trim()).toBe('Nickname: romeo');
            expect(user_els[0].querySelector('.list-group-item:nth-child(3n) div').textContent.trim()).toBe('Affiliation: owner');

            tab = modal.el.querySelector('#roles-tab');
            tab.click();
            select = modal.el.querySelector('.select-role');
            expect(u.isVisible(select)).toBe(true);
            expect(select.value).toBe('moderator');
            button = modal.el.querySelector('.btn-primary[name="users_with_role"]');
            button.click();

            const roles_panel = modal.el.querySelector('#roles-tabpanel');
            await u.waitUntil(() => roles_panel.querySelectorAll('.list-group--users > li').length === 1);
            select.value = 'participant';
            button.click();
            await u.waitUntil(() => !modal.loading_users_with_affiliation);
            user_els = roles_panel.querySelectorAll('.list-group--users > li')
            expect(user_els.length).toBe(1);
            expect(user_els[0].textContent.trim()).toBe('No users with that role found.');
            done();
        }));
    });
}));
