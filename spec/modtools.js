/*global mock */

const _ = converse.env._;
const $iq = converse.env.$iq;
const $pres = converse.env.$pres;
const sizzle = converse.env.sizzle;
const Strophe = converse.env.Strophe;
const u = converse.env.utils;

describe("The groupchat moderator tool", function () {

    it("allows you to set affiliations and roles",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
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
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', [], members);
        const view = _converse.chatboxviews.get(muc_jid);
        await u.waitUntil(() => (view.model.occupants.length === 5), 1000);

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
        expect(select.value).toBe('owner');
        select.value = 'admin';
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
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => view.model.occupants.fetchMembers.calls.count());

        members = [
            {'jid': 'hag66@shakespeare.lit', 'nick': 'witch', 'affiliation': 'member'},
            {'jid': 'gower@shakespeare.lit', 'nick': 'gower', 'affiliation': 'member'},
            {'jid': 'wiccarocks@shakespeare.lit', 'nick': 'wiccan', 'affiliation': 'admin'},
            {'jid': 'crone1@shakespeare.lit', 'nick': 'thirdwitch', 'affiliation': 'admin'},
            {'jid': 'romeo@montague.lit', 'nick': 'romeo', 'affiliation': 'owner'},
        ];
        await mock.returnMemberLists(_converse, muc_jid, members);
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

    it("allows you to filter affiliation search results",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

        spyOn(_converse.ChatRoomView.prototype, 'showModeratorToolsModal').and.callThrough();
        const muc_jid = 'lounge@montague.lit';
        const members = [
            {'jid': 'hag66@shakespeare.lit', 'nick': 'witch', 'affiliation': 'member'},
            {'jid': 'gower@shakespeare.lit', 'nick': 'gower', 'affiliation': 'member'},
            {'jid': 'wiccarocks@shakespeare.lit', 'nick': 'wiccan', 'affiliation': 'member'},
            {'jid': 'crone1@shakespeare.lit', 'nick': 'thirdwitch', 'affiliation': 'member'},
            {'jid': 'romeo@montague.lit', 'nick': 'romeo', 'affiliation': 'member'},
            {'jid': 'juliet@capulet.lit', 'nick': 'juliet', 'affiliation': 'member'},
        ];
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', [], members);
        const view = _converse.chatboxviews.get(muc_jid);
        await u.waitUntil(() => (view.model.occupants.length === 6), 1000);

        const textarea = view.el.querySelector('.chat-textarea');
        textarea.value = '/modtools';
        const enter = { 'target': textarea, 'preventDefault': function preventDefault () {}, 'keyCode': 13 };
        view.onKeyDown(enter);
        await u.waitUntil(() => view.showModeratorToolsModal.calls.count());

        const modal = view.modtools_modal;
        await u.waitUntil(() => u.isVisible(modal.el), 1000);
        // Clear so that we don't match older stanzas
        _converse.connection.IQ_stanzas = [];
        const select = modal.el.querySelector('.select-affiliation');
        expect(select.value).toBe('owner');
        select.value = 'member';
        const button = modal.el.querySelector('.btn-primary[name="users_with_affiliation"]');
        button.click();
        await u.waitUntil(() => !modal.loading_users_with_affiliation);
        const user_els = modal.el.querySelectorAll('.list-group--users > li');
        expect(user_els.length).toBe(6);

        const nicks = Array.from(modal.el.querySelectorAll('.list-group--users > li')).map(el => el.getAttribute('data-nick'));
        expect(nicks.join(' ')).toBe('gower juliet romeo thirdwitch wiccan witch');

        const filter = modal.el.querySelector('[name="filter"]');
        expect(filter).not.toBe(null);

        filter.value = 'romeo';
        u.triggerEvent(filter, "keyup", "KeyboardEvent");
        await u.waitUntil(() => ( modal.el.querySelectorAll('.list-group--users > li').length === 1));

        filter.value = 'r';
        u.triggerEvent(filter, "keyup", "KeyboardEvent");
        await u.waitUntil(() => ( modal.el.querySelectorAll('.list-group--users > li').length === 3));

        filter.value = 'gower';
        u.triggerEvent(filter, "keyup", "KeyboardEvent");
        await u.waitUntil(() => ( modal.el.querySelectorAll('.list-group--users > li').length === 1));

        filter.value = 'RoMeO';
        u.triggerEvent(filter, "keyup", "KeyboardEvent");
        await u.waitUntil(() => ( modal.el.querySelectorAll('.list-group--users > li').length === 1));

        done();
    }));

    it("allows you to filter role search results",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

        spyOn(_converse.ChatRoomView.prototype, 'showModeratorToolsModal').and.callThrough();
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', []);
        const view = _converse.chatboxviews.get(muc_jid);

        _converse.connection._dataRecv(mock.createRequest(
            $pres({to: _converse.jid, from: `${muc_jid}/nomorenicks`})
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': `nomorenicks@montague.lit`,
                    'role': 'participant'
                })
        ));
        _converse.connection._dataRecv(mock.createRequest(
            $pres({to: _converse.jid, from: `${muc_jid}/newb`})
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': `newb@montague.lit`,
                    'role': 'participant'
                })
        ));
        _converse.connection._dataRecv(mock.createRequest(
            $pres({to: _converse.jid, from: `${muc_jid}/some1`})
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': `some1@montague.lit`,
                    'role': 'participant'
                })
        ));
        _converse.connection._dataRecv(mock.createRequest(
            $pres({to: _converse.jid, from: `${muc_jid}/oldhag`})
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': `oldhag@montague.lit`,
                    'role': 'participant'
                })
        ));
        _converse.connection._dataRecv(mock.createRequest(
            $pres({to: _converse.jid, from: `${muc_jid}/crone`})
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': `crone@montague.lit`,
                    'role': 'participant'
                })
        ));
        _converse.connection._dataRecv(mock.createRequest(
            $pres({to: _converse.jid, from: `${muc_jid}/tux`})
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': `tux@montague.lit`,
                    'role': 'participant'
                })
        ));
        await u.waitUntil(() => (view.model.occupants.length === 7), 1000);

        const textarea = view.el.querySelector('.chat-textarea');
        textarea.value = '/modtools';
        const enter = { 'target': textarea, 'preventDefault': function preventDefault () {}, 'keyCode': 13 };
        view.onKeyDown(enter);
        await u.waitUntil(() => view.showModeratorToolsModal.calls.count());

        const modal = view.modtools_modal;
        await u.waitUntil(() => u.isVisible(modal.el), 1000);

        const tab = modal.el.querySelector('#roles-tab');
        tab.click();

        // Clear so that we don't match older stanzas
        _converse.connection.IQ_stanzas = [];

        const select = modal.el.querySelector('.select-role');
        expect(select.value).toBe('moderator');
        select.value = 'participant';

        const button = modal.el.querySelector('.btn-primary[name="users_with_role"]');
        button.click();
        await u.waitUntil(() => !modal.loading_users_with_role);
        const user_els = modal.el.querySelectorAll('.list-group--users > li');
        expect(user_els.length).toBe(6);

        const nicks = Array.from(modal.el.querySelectorAll('.list-group--users > li')).map(el => el.getAttribute('data-nick'));
        expect(nicks.join(' ')).toBe('crone newb nomorenicks oldhag some1 tux');

        const filter = modal.el.querySelector('[name="filter"]');
        expect(filter).not.toBe(null);

        filter.value = 'tux';
        u.triggerEvent(filter, "keyup", "KeyboardEvent");
        await u.waitUntil(() => ( modal.el.querySelectorAll('.list-group--users > li').length === 1));

        filter.value = 'r';
        u.triggerEvent(filter, "keyup", "KeyboardEvent");
        await u.waitUntil(() => ( modal.el.querySelectorAll('.list-group--users > li').length === 2));

        filter.value = 'crone';
        u.triggerEvent(filter, "keyup", "KeyboardEvent");
        await u.waitUntil(() => ( modal.el.querySelectorAll('.list-group--users > li').length === 1));
        done();
    }));

    it("shows an error message if a particular affiliation list may not be retrieved",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        spyOn(_converse.ChatRoomView.prototype, 'showModeratorToolsModal').and.callThrough();
        const muc_jid = 'lounge@montague.lit';
        const members = [
            {'jid': 'hag66@shakespeare.lit', 'nick': 'witch', 'affiliation': 'member'},
            {'jid': 'gower@shakespeare.lit', 'nick': 'gower', 'affiliation': 'member'},
            {'jid': 'wiccarocks@shakespeare.lit', 'nick': 'wiccan', 'affiliation': 'admin'},
            {'jid': 'crone1@shakespeare.lit', 'nick': 'thirdwitch', 'affiliation': 'owner'},
            {'jid': 'romeo@montague.lit', 'nick': 'romeo', 'affiliation': 'owner'},
        ];
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', [], members);
        const view = _converse.chatboxviews.get(muc_jid);
        await u.waitUntil(() => (view.model.occupants.length === 5));

        const textarea = view.el.querySelector('.chat-textarea');
        textarea.value = '/modtools';
        const enter = { 'target': textarea, 'preventDefault': function preventDefault () {}, 'keyCode': 13 };
        view.onKeyDown(enter);
        await u.waitUntil(() => view.showModeratorToolsModal.calls.count());

        const modal = view.modtools_modal;
        await u.waitUntil(() => u.isVisible(modal.el), 1000);
        const tab = modal.el.querySelector('#affiliations-tab');
        // Clear so that we don't match older stanzas
        _converse.connection.IQ_stanzas = [];
        const IQ_stanzas = _converse.connection.IQ_stanzas;
        tab.click();
        const select = modal.el.querySelector('.select-affiliation');
        select.value = 'outcast';
        const button = modal.el.querySelector('.btn-primary[name="users_with_affiliation"]');
        button.click();

        const iq_query = await u.waitUntil(() => _.filter(
            IQ_stanzas,
            s => sizzle(`iq[to="${muc_jid}"] query[xmlns="${Strophe.NS.MUC_ADMIN}"] item[affiliation="outcast"]`, s).length
        ).pop());

        const error = u.toStanza(
            `<iq from="${muc_jid}"
                 id="${iq_query.getAttribute('id')}"
                 type="error"
                 to="${_converse.jid}">

                 <error type="auth">
                    <forbidden xmlns="${Strophe.NS.STANZAS}"/>
                 </error>
            </iq>`);
        _converse.connection._dataRecv(mock.createRequest(error));
        await u.waitUntil(() => !modal.loading_users_with_affiliation);

        const user_els = modal.el.querySelectorAll('.list-group--users > li');
        expect(user_els.length).toBe(1);
        expect(user_els[0].textContent.trim()).toBe('Error: not allowed to fetch outcast list for MUC lounge@montague.lit');
        done();
    }));
});
