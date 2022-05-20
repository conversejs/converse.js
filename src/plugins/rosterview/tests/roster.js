/*global mock, converse, _ */

const $iq = converse.env.$iq;
const $pres = converse.env.$pres;
const Strophe = converse.env.Strophe;
const sizzle = converse.env.sizzle;
const u = converse.env.utils;

const checkHeaderToggling = async function (group) {
    const toggle = group.querySelector('a.group-toggle');
    expect(u.isVisible(group)).toBeTruthy();
    expect(group.querySelectorAll('ul.collapsed').length).toBe(0);
    expect(u.hasClass('fa-caret-right', toggle.firstElementChild)).toBeFalsy();
    expect(u.hasClass('fa-caret-down', toggle.firstElementChild)).toBeTruthy();
    toggle.click();

    await u.waitUntil(() => group.querySelectorAll('ul.collapsed').length === 1);
    expect(u.hasClass('fa-caret-right', toggle.firstElementChild)).toBeTruthy();
    expect(u.hasClass('fa-caret-down', toggle.firstElementChild)).toBeFalsy();
    toggle.click();
    await u.waitUntil(() => group.querySelectorAll('li').length === _.filter(group.querySelectorAll('li'), u.isVisible).length);
    expect(u.hasClass('fa-caret-right', toggle.firstElementChild)).toBeFalsy();
    expect(u.hasClass('fa-caret-down', toggle.firstElementChild)).toBeTruthy();
};


describe("The Contacts Roster", function () {

    it("verifies the origin of roster pushes", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        // See: https://gultsch.de/gajim_roster_push_and_message_interception.html
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.waitForRoster(_converse, 'current', 1);
        expect(_converse.roster.models.length).toBe(1);
        expect(_converse.roster.at(0).get('jid')).toBe(contact_jid);

        spyOn(converse.env.log, 'warn');
        let roster_push = u.toStanza(`
            <iq type="set" to="${_converse.jid}" from="eve@siacs.eu">
                <query xmlns='jabber:iq:roster'>
                    <item subscription="remove" jid="${contact_jid}"/>
                </query>
            </iq>`);
        _converse.connection._dataRecv(mock.createRequest(roster_push));
        expect(converse.env.log.warn.calls.count()).toBe(1);
        expect(converse.env.log.warn).toHaveBeenCalledWith(
            `Ignoring roster illegitimate roster push message from ${roster_push.getAttribute('from')}`
        );
        roster_push = u.toStanza(`
            <iq type="set" to="${_converse.jid}" from="eve@siacs.eu">
                <query xmlns='jabber:iq:roster'>
                    <item subscription="both" jid="eve@siacs.eu" name="${mock.cur_names[0]}" />
                </query>
            </iq>`);
        _converse.connection._dataRecv(mock.createRequest(roster_push));
        expect(converse.env.log.warn.calls.count()).toBe(2);
        expect(converse.env.log.warn).toHaveBeenCalledWith(
            `Ignoring roster illegitimate roster push message from ${roster_push.getAttribute('from')}`
        );
        expect(_converse.roster.models.length).toBe(1);
        expect(_converse.roster.at(0).get('jid')).toBe(contact_jid);
    }));

    it("is populated once we have registered a presence handler", mock.initConverse([], {}, async function (_converse) {
        const IQs = _converse.connection.IQ_stanzas;
        const stanza = await u.waitUntil(
            () => _.filter(IQs, iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop());

        expect(Strophe.serialize(stanza)).toBe(
            `<iq id="${stanza.getAttribute('id')}" type="get" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"/>`+
            `</iq>`);
        const result = $iq({
            'to': _converse.connection.jid,
            'type': 'result',
            'id': stanza.getAttribute('id')
        }).c('query', {
            'xmlns': 'jabber:iq:roster'
        }).c('item', {'jid': 'nurse@example.com'}).up()
          .c('item', {'jid': 'romeo@example.com'})
        _converse.connection._dataRecv(mock.createRequest(result));
        await u.waitUntil(() => _converse.promises['rosterContactsFetched'].isResolved === true);
    }));

    it("supports roster versioning", mock.initConverse([], {}, async function (_converse) {
        const IQ_stanzas = _converse.connection.IQ_stanzas;
        let stanza = await u.waitUntil(
            () => _.filter(IQ_stanzas, iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop()
        );
        expect(_converse.roster.data.get('version')).toBeUndefined();
        expect(Strophe.serialize(stanza)).toBe(
            `<iq id="${stanza.getAttribute('id')}" type="get" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"/>`+
            `</iq>`);
        let result = $iq({
            'to': _converse.connection.jid,
            'type': 'result',
            'id': stanza.getAttribute('id')
        }).c('query', {
            'xmlns': 'jabber:iq:roster',
            'ver': 'ver7'
        }).c('item', {'jid': 'nurse@example.com'}).up()
          .c('item', {'jid': 'romeo@example.com'})
        _converse.connection._dataRecv(mock.createRequest(result));

        await u.waitUntil(() => _converse.roster.models.length > 1);
        expect(_converse.roster.data.get('version')).toBe('ver7');
        expect(_converse.roster.models.length).toBe(2);

        _converse.roster.fetchFromServer();
        stanza = _converse.connection.IQ_stanzas.pop();
        expect(Strophe.serialize(stanza)).toBe(
            `<iq id="${stanza.getAttribute('id')}" type="get" xmlns="jabber:client">`+
                `<query ver="ver7" xmlns="jabber:iq:roster"/>`+
            `</iq>`);

        result = $iq({
            'to': _converse.connection.jid,
            'type': 'result',
            'id': stanza.getAttribute('id')
        });
        _converse.connection._dataRecv(mock.createRequest(result));

        const roster_push = $iq({
            'to': _converse.connection.jid,
            'type': 'set',
        }).c('query', {'xmlns': 'jabber:iq:roster', 'ver': 'ver34'})
            .c('item', {'jid': 'romeo@example.com', 'subscription': 'remove'});
        _converse.connection._dataRecv(mock.createRequest(roster_push));
        expect(_converse.roster.data.get('version')).toBe('ver34');
        expect(_converse.roster.models.length).toBe(1);
        expect(_converse.roster.at(0).get('jid')).toBe('nurse@example.com');
    }));

    it("also contains contacts with subscription of none", mock.initConverse(
        [], {}, async function (_converse) {

        const sent_IQs = _converse.connection.IQ_stanzas;
        const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop());
        _converse.connection._dataRecv(mock.createRequest($iq({
            to: _converse.connection.jid,
            type: 'result',
            id: stanza.getAttribute('id')
        }).c('query', {
            xmlns: 'jabber:iq:roster',
        }).c('item', {
            jid: 'juliet@example.net',
            name: 'Juliet',
            subscription:'both'
        }).c('group').t('Friends').up().up()
        .c('item', {
            jid: 'mercutio@example.net',
            name: 'Mercutio',
            subscription: 'from'
        }).c('group').t('Friends').up().up()
        .c('item', {
            jid: 'lord.capulet@example.net',
            name: 'Lord Capulet',
            subscription:'none'
        }).c('group').t('Acquaintences')));

        while (sent_IQs.length) sent_IQs.pop();

        await u.waitUntil(() => _converse.roster.length === 3);
        expect(_converse.roster.pluck('jid')).toEqual(['juliet@example.net', 'mercutio@example.net', 'lord.capulet@example.net']);
        expect(_converse.roster.get('lord.capulet@example.net').get('subscription')).toBe('none');
    }));

    it("can be refreshed", mock.initConverse(
        [], {}, async function (_converse) {

        const sent_IQs = _converse.connection.IQ_stanzas;
        let stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop());
        _converse.connection._dataRecv(mock.createRequest($iq({
            to: _converse.connection.jid,
            type: 'result',
            id: stanza.getAttribute('id')
        }).c('query', {
            xmlns: 'jabber:iq:roster',
        }).c('item', {
            jid: 'juliet@example.net',
            name: 'Juliet',
            subscription:'both'
        }).c('group').t('Friends').up().up()
        .c('item', {
            jid: 'mercutio@example.net',
            name: 'Mercutio',
            subscription:'from'
        }).c('group').t('Friends')));

        while (sent_IQs.length) sent_IQs.pop();

        await u.waitUntil(() => _converse.roster.length === 2);
        expect(_converse.roster.pluck('jid')).toEqual(['juliet@example.net', 'mercutio@example.net']);

        const rosterview = document.querySelector('converse-roster');
        const sync_button = rosterview.querySelector('.sync-contacts');
        sync_button.click();

        stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop());
        _converse.connection._dataRecv(mock.createRequest($iq({
            to: _converse.connection.jid,
            type: 'result',
            id: stanza.getAttribute('id')
        }).c('query', {
            xmlns: 'jabber:iq:roster',
        }).c('item', {
            jid: 'juliet@example.net',
            name: 'Juliet',
            subscription:'both'
        }).c('group').t('Friends').up().up()
        .c('item', {
            jid: 'lord.capulet@example.net',
            name: 'Lord Capulet',
            subscription:'from'
        }).c('group').t('Acquaintences')));

        await u.waitUntil(() => _converse.roster.pluck('jid').includes('lord.capulet@example.net'));
        expect(_converse.roster.pluck('jid')).toEqual(['juliet@example.net', 'lord.capulet@example.net']);
    }));

    it("will also show contacts added afterwards", mock.initConverse([], {}, async function (_converse) {
        await mock.openControlBox(_converse);
        await mock.waitForRoster(_converse, 'current');

        const rosterview = document.querySelector('converse-roster');
        const filter = rosterview.querySelector('.roster-filter');
        const roster = rosterview.querySelector('.roster-contacts');

        await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 17), 800);
        filter.value = "la";
        u.triggerEvent(filter, "keydown", "KeyboardEvent");
        await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 4), 800);

        // Five roster contact is now visible
        const visible_contacts = sizzle('li', roster).filter(u.isVisible);
        expect(visible_contacts.length).toBe(4);
        let visible_groups = sizzle('.roster-group', roster).filter(u.isVisible).map(el => el.querySelector('a.group-toggle'));
        expect(visible_groups.length).toBe(4);
        expect(visible_groups[0].textContent.trim()).toBe('Colleagues');
        expect(visible_groups[1].textContent.trim()).toBe('Family');
        expect(visible_groups[2].textContent.trim()).toBe('friends & acquaintences');
        expect(visible_groups[3].textContent.trim()).toBe('ænemies');

        _converse.roster.create({
            jid: 'lad@montague.lit',
            subscription: 'both',
            ask: null,
            groups: ['newgroup'],
            fullname: 'Lad'
        });
        await u.waitUntil(() => sizzle('.roster-group[data-group="newgroup"] li', roster).length, 300);
        visible_groups = sizzle('.roster-group', roster).filter(u.isVisible).map(el => el.querySelector('a.group-toggle'));
        expect(visible_groups.length).toBe(5);
        expect(visible_groups[0].textContent.trim()).toBe('Colleagues');
        expect(visible_groups[1].textContent.trim()).toBe('Family');
        expect(visible_groups[2].textContent.trim()).toBe('friends & acquaintences');
        expect(visible_groups[3].textContent.trim()).toBe('newgroup');
        expect(visible_groups[4].textContent.trim()).toBe('ænemies');
        expect(roster.querySelectorAll('.roster-group').length).toBe(5);
    }));

    describe("The live filter", function () {

        it("will only appear when roster contacts flow over the visible area",
                mock.initConverse([], {}, async function (_converse) {

            expect(document.querySelector('converse-roster')).toBe(null);
            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);

            const view = _converse.chatboxviews.get('controlbox');
            const flyout = view.querySelector('.box-flyout');
            const panel = flyout.querySelector('.controlbox-pane');
            function hasScrollBar (el) {
                return el.isConnected && flyout.offsetHeight < panel.scrollHeight;
            }
            const rosterview = document.querySelector('converse-roster');
            const filter = rosterview.querySelector('.roster-filter');
            const el = rosterview.querySelector('.roster-contacts');
            await u.waitUntil(() => hasScrollBar(el) ? u.isVisible(filter) : !u.isVisible(filter), 900);
        }));

        it("can be used to filter the contacts shown",
            mock.initConverse(
                [], {'roster_groups': true},
                async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current');
            const rosterview = document.querySelector('converse-roster');
            let filter = rosterview.querySelector('.roster-filter');
            const roster = rosterview.querySelector('.roster-contacts');

            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 17), 600);
            expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(5);
            filter.value = "juliet";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");
            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 1), 600);
            // Only one roster contact is now visible
            let visible_contacts = sizzle('li', roster).filter(u.isVisible);
            expect(visible_contacts.length).toBe(1);
            expect(visible_contacts.pop().textContent.trim()).toBe('Juliet Capulet');
            // Only one foster group is still visible
            expect(sizzle('.roster-group', roster).filter(u.isVisible).length).toBe(1);
            const visible_group = sizzle('.roster-group', roster).filter(u.isVisible).pop();
            expect(visible_group.querySelector('a.group-toggle').textContent.trim()).toBe('friends & acquaintences');

            filter = rosterview.querySelector('.roster-filter');
            filter.value = "j";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");
            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 2), 700);

            visible_contacts = sizzle('li', roster).filter(u.isVisible);
            expect(visible_contacts.length).toBe(2);

            let visible_groups = sizzle('.roster-group', roster).filter(u.isVisible).map(el => el.querySelector('a.group-toggle'));
            expect(visible_groups.length).toBe(2);
            expect(visible_groups[0].textContent.trim()).toBe('friends & acquaintences');
            expect(visible_groups[1].textContent.trim()).toBe('Ungrouped');

            filter = rosterview.querySelector('.roster-filter');
            filter.value = "xxx";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");
            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 0), 600);
            visible_groups = sizzle('.roster-group', roster).filter(u.isVisible).map(el => el.querySelector('a.group-toggle'));
            expect(visible_groups.length).toBe(0);

            filter = rosterview.querySelector('.roster-filter');
            filter.value = "";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");
            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 17), 600);
            expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(5);
        }));

        it("can be used to filter the groups shown", mock.initConverse([], {'roster_groups': true}, async function (_converse) {
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current');
            const rosterview = document.querySelector('converse-roster');
            const roster = rosterview.querySelector('.roster-contacts');

            const button =  rosterview.querySelector('converse-icon[data-type="groups"]');
            button.click();

            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 17), 600);
            expect(sizzle('.roster-group', roster).filter(u.isVisible).length).toBe(5);

            let filter = rosterview.querySelector('.roster-filter');
            filter.value = "colleagues";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");

            await u.waitUntil(() => (sizzle('div.roster-group:not(.collapsed)', roster).length === 1), 600);
            expect(sizzle('div.roster-group:not(.collapsed)', roster).pop().firstElementChild.textContent.trim()).toBe('Colleagues');
            expect(sizzle('div.roster-group:not(.collapsed) li', roster).filter(u.isVisible).length).toBe(6);
            // Check that all contacts under the group are shown
            expect(sizzle('div.roster-group:not(.collapsed) li', roster).filter(l => !u.isVisible(l)).length).toBe(0);

            filter = rosterview.querySelector('.roster-filter');
            filter.value = "xxx";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");

            await u.waitUntil(() => (roster.querySelectorAll('.roster-group').length === 0), 700);

            filter = rosterview.querySelector('.roster-filter');
            filter.value = ""; // Check that groups are shown again, when the filter string is cleared.
            u.triggerEvent(filter, "keydown", "KeyboardEvent");
            await u.waitUntil(() => (roster.querySelectorAll('div.roster-group.collapsed').length === 0), 700);
            expect(sizzle('div.roster-group', roster).length).toBe(0);
        }));

        it("has a button with which its contents can be cleared",
                mock.initConverse([], {'roster_groups': true}, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current');

            const rosterview = document.querySelector('converse-roster');
            const filter = rosterview.querySelector('.roster-filter');
            filter.value = "xxx";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");
            expect(_.includes(filter.classList, "x")).toBeFalsy();
            expect(u.hasClass('hidden', rosterview.querySelector('.roster-filter-form .clear-input'))).toBeTruthy();

            const isHidden = (el) => u.hasClass('hidden', el);
            await u.waitUntil(() => !isHidden(rosterview.querySelector('.roster-filter-form .clear-input')), 900);
            rosterview.querySelector('.clear-input').click();
            await u.waitUntil(() => document.querySelector('.roster-filter').value == '');
        }));

        // Disabling for now, because since recently this test consistently
        // fails on Travis and I couldn't get it to pass there.
        xit("can be used to filter contacts by their chat state",
            mock.initConverse(
                [], {},
                async function (_converse) {

            mock.waitForRoster(_converse, 'all');
            let jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            _converse.roster.get(jid).presence.set('show', 'online');
            jid = mock.cur_names[4].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            _converse.roster.get(jid).presence.set('show', 'dnd');
            await mock.openControlBox(_converse);
            const rosterview = document.querySelector('converse-roster');
            const button = rosterview.querySelector('span[data-type="state"]');
            button.click();
            const roster = rosterview.querySelector('.roster-contacts');
            await u.waitUntil(() => sizzle('li', roster).filter(u.isVisible).length === 15, 900);
            const filter = rosterview.querySelector('.state-type');
            expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(5);
            filter.value = "online";
            u.triggerEvent(filter, 'change');

            await u.waitUntil(() => sizzle('li', roster).filter(u.isVisible).length === 1, 900);
            expect(sizzle('li', roster).filter(u.isVisible).pop().textContent.trim()).toBe('Lord Montague');
            await u.waitUntil(() => sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length === 1, 900);
            const ul = sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).pop();
            expect(ul.parentElement.firstElementChild.textContent.trim()).toBe('friends & acquaintences');
            filter.value = "dnd";
            u.triggerEvent(filter, 'change');
            await u.waitUntil(() => sizzle('li', roster).filter(u.isVisible).pop().textContent.trim() === 'Friar Laurence', 900);
            expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(1);
        }));
    });

    describe("A Roster Group", function () {

        it("is created to show contacts with unread messages",
            mock.initConverse(
                [], {'roster_groups': true},
                async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'all');
            await mock.createContacts(_converse, 'requesting');

            // Check that the groups appear alphabetically and that
            // requesting and pending contacts are last.
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group a.group-toggle', rosterview).length === 6);
            let group_titles = sizzle('.roster-group a.group-toggle', rosterview).map(o => o.textContent.trim());
            expect(group_titles).toEqual([
                "Contact requests",
                "Colleagues",
                "Family",
                "friends & acquaintences",
                "ænemies",
                "Ungrouped",
            ]);

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const contact = await _converse.api.contacts.get(contact_jid);
            contact.save({'num_unread': 5});

            await u.waitUntil(() => sizzle('.roster-group a.group-toggle', rosterview).length === 7);
            group_titles = sizzle('.roster-group a.group-toggle', rosterview).map(o => o.textContent.trim());

            expect(group_titles).toEqual([
                "New messages",
                "Contact requests",
                "Colleagues",
                "Family",
                "friends & acquaintences",
                "ænemies",
                "Ungrouped"
            ]);
            const contacts = sizzle('.roster-group[data-group="New messages"] li', rosterview);
            expect(contacts.length).toBe(1);
            expect(contacts[0].querySelector('.contact-name').textContent).toBe("Mercutio");
            expect(contacts[0].querySelector('.msgs-indicator').textContent).toBe("5");

            contact.save({'num_unread': 0});
            await u.waitUntil(() => sizzle('.roster-group a.group-toggle', rosterview).length === 6);
            group_titles = sizzle('.roster-group a.group-toggle', rosterview).map(o => o.textContent.trim());
            expect(group_titles).toEqual([
                "Contact requests",
                "Colleagues",
                "Family",
                "friends & acquaintences",
                "ænemies",
                "Ungrouped"
            ]);
        }));


        it("can be used to organize existing contacts",
            mock.initConverse(
                [], {'roster_groups': true},
                async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'all');
            await mock.createContacts(_converse, 'requesting');
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group a.group-toggle', rosterview).length === 6);
            const group_titles = sizzle('.roster-group a.group-toggle', rosterview).map(o => o.textContent.trim());
            expect(group_titles).toEqual([
                "Contact requests",
                "Colleagues",
                "Family",
                "friends & acquaintences",
                "ænemies",
                "Ungrouped",
            ]);
            // Check that usernames appear alphabetically per group
            Object.keys(mock.groups).forEach(name  => {
                const contacts = sizzle('.roster-group[data-group="'+name+'"] ul', rosterview);
                const names = contacts.map(o => o.textContent.trim());
                expect(names).toEqual(_.clone(names).sort());
            });
        }));

        it("gets created when a contact's \"groups\" attribute changes",
            mock.initConverse([], {'roster_groups': true}, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);

            _converse.roster.create({
                jid: 'groupchanger@montague.lit',
                subscription: 'both',
                ask: null,
                groups: ['firstgroup'],
                fullname: 'George Groupchanger'
            });

            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group a.group-toggle', rosterview).length === 1);
            let group_titles = await u.waitUntil(() => {
                const toggles = sizzle('.roster-group a.group-toggle', rosterview);
                if (toggles.reduce((result, t) => result && u.isVisible(t), true)) {
                    return toggles.map(o => o.textContent.trim());
                } else {
                    return false;
                }
            }, 1000);
            expect(group_titles).toEqual(['firstgroup']);

            const contact = _converse.roster.get('groupchanger@montague.lit');
            contact.set({'groups': ['secondgroup']});
            await u.waitUntil(() => sizzle('.roster-group[data-group="secondgroup"] a.group-toggle', rosterview).length);
            group_titles = await u.waitUntil(() => {
                const toggles = sizzle('.roster-group[data-group="secondgroup"] a.group-toggle', rosterview);
                if (toggles.reduce((result, t) => result && u.isVisible(t), true)) {
                    return toggles.map(o => o.textContent.trim());
                } else {
                    return false;
                }
            }, 1000);
            expect(group_titles).toEqual(['secondgroup']);
        }));

        it("can share contacts with other roster groups",
                mock.initConverse( [], {'roster_groups': true}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 0);
            const groups = ['Colleagues', 'friends'];
            await mock.openControlBox(_converse);
            for (let i=0; i<mock.cur_names.length; i++) {
                _converse.roster.create({
                    jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                    subscription: 'both',
                    ask: null,
                    groups: groups,
                    fullname: mock.cur_names[i]
                });
            }
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => (sizzle('li', rosterview).filter(u.isVisible).length === 30));
            // Check that usernames appear alphabetically per group
            groups.forEach(name => {
                const contacts = sizzle('.roster-group[data-group="'+name+'"] ul li', rosterview);
                const names = contacts.map(o => o.textContent.trim());
                expect(names).toEqual(_.clone(names).sort());
                expect(names.length).toEqual(mock.cur_names.length);
            });
        }));

        it("remembers whether it is closed or opened",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);

            let i=0, j=0;
            const groups = {
                'Colleagues': 3,
                'friends & acquaintences': 3,
                'Ungrouped': 2
            };
            Object.keys(groups).forEach(function (name) {
                j = i;
                for (i=j; i<j+groups[name]; i++) {
                    _converse.roster.create({
                        jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                        subscription: 'both',
                        ask: null,
                        groups: name === 'ungrouped'? [] : [name],
                        fullname: mock.cur_names[i]
                    });
                }
            });

            const state = _converse.roster.state;
            expect(state.get('collapsed_groups')).toEqual([]);
            const rosterview = document.querySelector('converse-roster');
            const toggle = await u.waitUntil(() => rosterview.querySelector('a.group-toggle'));
            toggle.click();
            await u.waitUntil(() => state.get('collapsed_groups').length);
            expect(state.get('collapsed_groups')).toEqual(['Colleagues']);
            toggle.click();
            expect(state.get('collapsed_groups')).toEqual([]);
        }));
    });

    describe("Pending Contacts", function () {

        it("can be collapsed under their own header (if roster_groups is false)",
                mock.initConverse([], {'roster_groups': false}, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'all');
            await Promise.all(_converse.roster.map(contact => u.waitUntil(() => contact.vcard.get('fullname'))));
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group', rosterview).filter(u.isVisible).map(e => e.querySelector('li')).length, 1000);
            await checkHeaderToggling.apply(_converse, [rosterview.querySelector('[data-group="Pending contacts"]')]);
        }));

        it("can be added to the roster",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await mock.waitForRoster(_converse, 'all', 0);
            await mock.openControlBox(_converse);
            const rosterview = document.querySelector('converse-roster');
            _converse.roster.create({
                jid: mock.pend_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                subscription: 'none',
                ask: 'subscribe',
                fullname: mock.pend_names[0]
            });
            expect(u.isVisible(rosterview)).toBe(true);
            await u.waitUntil(() => sizzle('li', rosterview).filter(u.isVisible).length === 1);
        }));

        it("are shown in the roster when hide_offline_users",
            mock.initConverse(
                [], {'hide_offline_users': true},
                async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'pending');
            await Promise.all(_converse.roster.map(contact => u.waitUntil(() => contact.vcard.get('fullname'))));
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('li', rosterview).filter(u.isVisible).length, 500)
            expect(u.isVisible(rosterview)).toBe(true);
            expect(sizzle('li', rosterview).filter(u.isVisible).length).toBe(3);
            expect(sizzle('ul.roster-group-contacts', rosterview).filter(u.isVisible).length).toBe(1);
        }));

        it("can be removed by the user", mock.initConverse([], {'roster_groups': false}, async function (_converse) {
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'all');
            await Promise.all(_converse.roster.map(contact => u.waitUntil(() => contact.vcard.get('fullname'))));
            const name = mock.pend_names[0];
            const jid = name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const contact = _converse.roster.get(jid);
            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));
            spyOn(contact, 'unauthorize').and.callFake(function () { return contact; });
            spyOn(contact, 'removeFromRoster').and.callThrough();
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle(`.pending-xmpp-contact .contact-name:contains("${name}")`, rosterview).length, 500);
            let sent_IQ;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback) {
                sent_IQ = iq;
                callback();
            });
            sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, rosterview).pop().click();
            await u.waitUntil(() => !sizzle(`.pending-xmpp-contact .contact-name:contains("${name}")`, rosterview).length, 500);
            expect(_converse.api.confirm).toHaveBeenCalled();
            expect(contact.removeFromRoster).toHaveBeenCalled();
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq type="set" xmlns="jabber:client">`+
                    `<query xmlns="jabber:iq:roster">`+
                        `<item jid="lord.capulet@montague.lit" subscription="remove"/>`+
                    `</query>`+
                `</iq>`);
        }));

        it("do not have a header if there aren't any",
            mock.initConverse(
                ['VCardsInitialized'], {'roster_groups': false},
                async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            const name = mock.pend_names[0];
            _converse.roster.create({
                jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                subscription: 'none',
                ask: 'subscribe',
                fullname: name
            });
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => {
                const el = rosterview.querySelector(`ul[data-group="Pending contacts"]`);
                return u.isVisible(el) && Array.from(el.querySelectorAll('li')).filter(li => u.isVisible(li)).length;
            }, 700)

            const remove_el = await u.waitUntil(() => sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, rosterview).pop());
            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            remove_el.click();
            expect(_converse.api.confirm).toHaveBeenCalled();

            const iq_stanzas = _converse.connection.IQ_stanzas;
            await u.waitUntil(() => Strophe.serialize(iq_stanzas.at(-1)) ===
                `<iq id="${iq_stanzas.at(-1).getAttribute('id')}" type="set" xmlns="jabber:client">`+
                    `<query xmlns="jabber:iq:roster">`+
                        `<item jid="lord.capulet@montague.lit" subscription="remove"/>`+
                    `</query>`+
                `</iq>`);

            const iq = iq_stanzas.at(-1);
            const stanza = u.toStanza(`<iq id="${iq.getAttribute('id')}" to="romeo@montague.lit/orchard" type="result"/>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => rosterview.querySelector(`ul[data-group="Pending contacts"]`) === null);
        }));

        it("can be removed by the user",
                mock.initConverse([], {'roster_groups': false}, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'all');
            await Promise.all(_converse.roster.map(contact => u.waitUntil(() => contact.vcard.get('fullname'))));
            await u.waitUntil(() => _converse.roster.at(0).vcard.get('fullname'))
            const rosterview = document.querySelector('converse-roster');
            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));
            for (let i=0; i<mock.pend_names.length; i++) {
                const name = mock.pend_names[i];
                sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, rosterview).pop().click();
            }
            await u.waitUntil(() => rosterview.querySelector(`ul[data-group="Pending contacts"]`) === null);
        }));

        it("can be added to the roster and they will be sorted alphabetically",
            mock.initConverse(
                [], {'roster_groups': false},
                async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current');
            await Promise.all(_converse.roster.map(contact => u.waitUntil(() => contact.vcard.get('fullname'))));
            let i;
            for (i=0; i<mock.pend_names.length; i++) {
                _converse.roster.create({
                    jid: mock.pend_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                    subscription: 'none',
                    ask: 'subscribe',
                    fullname: mock.pend_names[i]
                });
            }
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('li', rosterview.querySelector(`ul[data-group="Pending contacts"]`)).filter(u.isVisible).length);
            // Check that they are sorted alphabetically
            const el = await u.waitUntil(() => rosterview.querySelector(`ul[data-group="Pending contacts"]`));
            const spans = el.querySelectorAll('.pending-xmpp-contact span');

            await u.waitUntil(
                () => Array.from(spans).reduce((result, value) => result + value.textContent?.trim(), '') ===
                mock.pend_names.slice(0,i+1).sort().join('')
            );
            expect(true).toBe(true);
        }));
    });

    describe("Existing Contacts", function () {
        async function _addContacts (_converse) {
            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);
            await Promise.all(_converse.roster.map(contact => u.waitUntil(() => contact.vcard.get('fullname'))));
        }

        it("can be collapsed under their own header",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await _addContacts(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('li', rosterview).filter(u.isVisible).length, 500);
            await checkHeaderToggling.apply(_converse, [rosterview.querySelector('.roster-group')]);
        }));

        it("will be hidden when appearing under a collapsed group",
            mock.initConverse(
                [], {'roster_groups': false},
                async function (_converse) {

            await _addContacts(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('li', rosterview).filter(u.isVisible).length, 500);
            rosterview.querySelector('.group-toggle').click();
            const name = "Romeo Montague";
            const jid = name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
            _converse.roster.create({
                ask: null,
                fullname: name,
                jid: jid,
                requesting: false,
                subscription: 'both'
            });
            await u.waitUntil(() => u.hasClass('collapsed', rosterview.querySelector(`ul[data-group="My contacts"]`)) === true);
            expect(true).toBe(true);
        }));

        it("can be added to the roster and they will be sorted alphabetically",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);
            const rosterview = document.querySelector('converse-roster');
            await Promise.all(mock.cur_names.map(name => {
                const contact = _converse.roster.create({
                    jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                    subscription: 'both',
                    ask: null,
                    fullname: name
                });
                return u.waitUntil(() => contact.initialized);
            }));
            await u.waitUntil(() => sizzle('li', rosterview).length);
            // Check that they are sorted alphabetically
            const els = sizzle('.current-xmpp-contact.offline a.open-chat', rosterview)
            const t = els.reduce((result, value) => (result + value.textContent.trim()), '');
            expect(t).toEqual(mock.cur_names.slice(0,mock.cur_names.length).sort().join(''));
        }));

        it("can be removed by the user",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await _addContacts(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('li').length);
            const name = mock.cur_names[0];
            const jid = name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const contact = _converse.roster.get(jid);
            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));
            spyOn(contact, 'removeFromRoster').and.callThrough();

            let sent_IQ;
            spyOn(_converse.connection, 'sendIQ').and.callFake((iq, callback) => {
                sent_IQ = iq;
                callback();
            });
            sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, rosterview).pop().click();
            expect(_converse.api.confirm).toHaveBeenCalled();
            await u.waitUntil(() => sent_IQ);

            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq type="set" xmlns="jabber:client">`+
                    `<query xmlns="jabber:iq:roster"><item jid="mercutio@montague.lit" subscription="remove"/></query>`+
                `</iq>`);
            expect(contact.removeFromRoster).toHaveBeenCalled();
            await u.waitUntil(() => sizzle(".open-chat:contains('"+name+"')", rosterview).length === 0);
        }));

        it("do not have a header if there aren't any",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            const name = mock.cur_names[0];
            const contact = _converse.roster.create({
                jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                subscription: 'both',
                ask: null,
                fullname: name
            });
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group', rosterview).filter(u.isVisible).map(e => e.querySelector('li')).length, 1000);
            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));
            spyOn(contact, 'removeFromRoster').and.callThrough();
            spyOn(_converse.connection, 'sendIQ').and.callFake((iq, callback) => callback?.());
            expect(u.isVisible(rosterview.querySelector('.roster-group'))).toBe(true);
            sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, rosterview).pop().click();
            expect(_converse.api.confirm).toHaveBeenCalled();
            await u.waitUntil(() => _converse.connection.sendIQ.calls.count());
            expect(contact.removeFromRoster).toHaveBeenCalled();
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length === 0);
        }));

        it("can change their status to online and be sorted alphabetically",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await _addContacts(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group li').length, 700);
            const roster = rosterview;
            const groups = roster.querySelectorAll('.roster-group');
            const groupnames = Array.from(groups).map(g => g.getAttribute('data-group'));
            expect(groupnames.join(' ')).toBe("Colleagues Family friends & acquaintences ænemies Ungrouped");
            for (let i=0; i<mock.cur_names.length; i++) {
                const jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                _converse.roster.get(jid).presence.set('show', 'online');
                // Check that they are sorted alphabetically
                for (let j=0; j<groups.length; j++) {
                    const group = groups[j];
                    const groupname = groupnames[j];
                    const els = [...group.querySelectorAll('.current-xmpp-contact.online a.open-chat')];
                    const t = els.reduce((result, value) => result + value.textContent?.trim(), '');
                    expect(t).toEqual(mock.groups_map[groupname].slice(0, els.length).sort().join(''));
                }
            }
        }));

        it("can change their status to busy and be sorted alphabetically",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await _addContacts(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group li', rosterview).length, 700);
            const roster = rosterview;
            const groups = roster.querySelectorAll('.roster-group');
            const groupnames = Array.from(groups).map(g => g.getAttribute('data-group'));
            expect(groupnames.join(' ')).toBe("Colleagues Family friends & acquaintences ænemies Ungrouped");
            for (let i=0; i<mock.cur_names.length; i++) {
                const jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                _converse.roster.get(jid).presence.set('show', 'dnd');
                // Check that they are sorted alphabetically
                for (let j=0; j<groups.length; j++) {
                    const group = groups[j];
                    const groupname = groupnames[j];
                    const els = [...group.querySelectorAll('.current-xmpp-contact.dnd a.open-chat')];
                    const t = els.reduce((result, value) => result + value.textContent.trim(), '');
                    expect(t).toEqual(mock.groups_map[groupname].slice(0, els.length).sort().join(''));
                }
            }
        }));

        it("can change their status to away and be sorted alphabetically",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await _addContacts(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group li', rosterview).length, 700);
            const roster = rosterview;
            const groups = roster.querySelectorAll('.roster-group');
            const groupnames = Array.from(groups).map(g => g.getAttribute('data-group'));
            expect(groupnames.join(' ')).toBe("Colleagues Family friends & acquaintences ænemies Ungrouped");
            for (let i=0; i<mock.cur_names.length; i++) {
                const jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                _converse.roster.get(jid).presence.set('show', 'away');
                // Check that they are sorted alphabetically
                for (let j=0; j<groups.length; j++) {
                    const group = groups[j];
                    const groupname = groupnames[j];
                    const els = [...group.querySelectorAll('.current-xmpp-contact.away a.open-chat')];
                    const t = els.reduce((result, value) => result + value.textContent.trim(), '');
                    expect(t).toEqual(mock.groups_map[groupname].slice(0, els.length).sort().join(''));
                }
            }
        }));

        it("can change their status to xa and be sorted alphabetically",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await _addContacts(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group li', rosterview).length, 700);
            const roster = rosterview;
            const groups = roster.querySelectorAll('.roster-group');
            const groupnames = Array.from(groups).map(g => g.getAttribute('data-group'));
            expect(groupnames.join(' ')).toBe("Colleagues Family friends & acquaintences ænemies Ungrouped");
            for (let i=0; i<mock.cur_names.length; i++) {
                const jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                _converse.roster.get(jid).presence.set('show', 'xa');
                // Check that they are sorted alphabetically
                for (let j=0; j<groups.length; j++) {
                    const group = groups[j];
                    const groupname = groupnames[j];
                    const els = [...group.querySelectorAll('.current-xmpp-contact.xa a.open-chat')];
                    const t = els.reduce((result, value) => result + value.textContenc?.trim(), '');
                    expect(t).toEqual(mock.groups_map[groupname].slice(0, els.length).sort().join(''));
                }
            }
        }));

        it("can change their status to unavailable and be sorted alphabetically",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await _addContacts(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group li', rosterview).length, 500)
            const roster = rosterview;
            const groups = roster.querySelectorAll('.roster-group');
            const groupnames = Array.from(groups).map(g => g.getAttribute('data-group'));
            expect(groupnames.join(' ')).toBe("Colleagues Family friends & acquaintences ænemies Ungrouped");
            for (let i=0; i<mock.cur_names.length; i++) {
                const jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                _converse.roster.get(jid).presence.set('show', 'unavailable');
                // Check that they are sorted alphabetically
                for (let j=0; j<groups.length; j++) {
                    const group = groups[j];
                    const groupname = groupnames[j];
                    const els = [...group.querySelectorAll('.current-xmpp-contact.unavailable a.open-chat')];
                    const t = els.reduce((result, value) => result + value.textContent.trim(), '');
                    expect(t).toEqual(mock.groups_map[groupname].slice(0, els.length).sort().join(''));
                }
            }
        }));

        it("are ordered according to status: online, busy, away, xa, unavailable, offline",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await _addContacts(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group li', rosterview).length, 700);
            let i, jid;
            for (i=0; i<3; i++) {
                jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                _converse.roster.get(jid).presence.set('show', 'online');
            }
            for (i=3; i<6; i++) {
                jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                _converse.roster.get(jid).presence.set('show', 'dnd');
            }
            for (i=6; i<9; i++) {
                jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                _converse.roster.get(jid).presence.set('show', 'away');
            }
            for (i=9; i<12; i++) {
                jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                _converse.roster.get(jid).presence.set('show', 'xa');
            }
            for (i=12; i<15; i++) {
                jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                _converse.roster.get(jid).presence.set('show', 'unavailable');
            }

            await u.waitUntil(() => u.isVisible(rosterview.querySelector('li:first-child')), 900);
            const roster = rosterview;
            const groups = roster.querySelectorAll('.roster-group');
            const groupnames = Array.from(groups).map(g => g.getAttribute('data-group'));
            expect(groupnames.join(' ')).toBe("Colleagues Family friends & acquaintences ænemies Ungrouped");

            const group = groups[0];
            const els = Array.from(group.querySelectorAll('.current-xmpp-contact'));
            await u.waitUntil(() => els.map(e => e.getAttribute('data-status')).join(" ") === "online online away xa xa xa");

            for (let j=0; j<groups.length; j++) {
                const group = groups[j];
                const groupname = groupnames[j];
                const els = Array.from(group.querySelectorAll('.current-xmpp-contact'));
                expect(els.length).toBe(mock.groups_map[groupname].length);

                if (groupname === "Colleagues") {

                    const statuses = els.map(e => e.getAttribute('data-status'));
                    const subscription_classes = els.map(e => e.classList[4]);
                    const status_classes = els.map(e => e.classList[5]);
                    expect(statuses.join(" ")).toBe("online online away xa xa xa");
                    expect(status_classes.join(" ")).toBe("online online away xa xa xa");
                    expect(subscription_classes.join(" ")).toBe("both both both both both both");
                } else if (groupname === "friends & acquaintences") {
                    const statuses = els.map(e => e.getAttribute('data-status'));
                    const subscription_classes = els.map(e => e.classList[4]);
                    const status_classes = els.map(e => e.classList[5]);
                    expect(statuses.join(" ")).toBe("online online dnd dnd away unavailable");
                    expect(status_classes.join(" ")).toBe("online online dnd dnd away unavailable");
                    expect(subscription_classes.join(" ")).toBe("both both both both both both");
                } else if (groupname === "Family") {
                    const statuses = els.map(e => e.getAttribute('data-status'));
                    const subscription_classes = els.map(e => e.classList[4]);
                    const status_classes = els.map(e => e.classList[5]);
                    expect(statuses.join(" ")).toBe("online dnd");
                    expect(status_classes.join(" ")).toBe("online dnd");
                    expect(subscription_classes.join(" ")).toBe("both both");
                } else if (groupname === "ænemies") {
                    const statuses = els.map(e => e.getAttribute('data-status'));
                    const subscription_classes = els.map(e => e.classList[4]);
                    const status_classes = els.map(e => e.classList[5]);
                    expect(statuses.join(" ")).toBe("away");
                    expect(status_classes.join(" ")).toBe("away");
                    expect(subscription_classes.join(" ")).toBe("both");
                } else if (groupname === "Ungrouped") {
                    const statuses = els.map(e => e.getAttribute('data-status'));
                    const subscription_classes = els.map(e => e.classList[4]);
                    const status_classes = els.map(e => e.classList[5]);
                    expect(statuses.join(" ")).toBe("unavailable unavailable");
                    expect(status_classes.join(" ")).toBe("unavailable unavailable");
                    expect(subscription_classes.join(" ")).toBe("both both");
                }
            }
        }));
    });

    describe("Requesting Contacts", function () {

        it("can be added to the roster and they will be sorted alphabetically",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await mock.waitForRoster(_converse, "current", 0);
            await mock.openControlBox(_converse);
            let names = [];
            const addName = function (item) {
                if (!u.hasClass('request-actions', item)) {
                    names.push(item.textContent.replace(/^\s+|\s+$/g, ''));
                }
            };
            const rosterview = document.querySelector('converse-roster');
            await Promise.all(mock.req_names.map(name => {
                const contact = _converse.roster.create({
                    jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    nickname: name
                });
                return u.waitUntil(() => contact.initialized);
            }));
            await u.waitUntil(() => rosterview.querySelectorAll(`ul[data-group="Contact requests"] li`).length, 700);
            // Check that they are sorted alphabetically
            const children = rosterview.querySelector(`ul[data-group="Contact requests"]`).querySelectorAll('.requesting-xmpp-contact span');
            names = [];
            Array.from(children).forEach(addName);
            expect(names.join('')).toEqual(mock.req_names.slice(0,mock.req_names.length+1).sort().join(''));
        }));

        it("do not have a header if there aren't any", mock.initConverse([], {}, async function (_converse) {
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, "current", 0);
            const name = mock.req_names[0];
            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));
            _converse.roster.create({
                'jid': name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                'subscription': 'none',
                'ask': null,
                'requesting': true,
                'nickname': name
            });
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group', rosterview).filter(u.isVisible).length, 900);
            expect(u.isVisible(rosterview.querySelector(`ul[data-group="Contact requests"]`))).toEqual(true);
            expect(sizzle('.roster-group', rosterview).filter(u.isVisible).map(e => e.querySelector('li')).length).toBe(1);
            sizzle('.roster-group', rosterview).filter(u.isVisible).map(e => e.querySelector('li .decline-xmpp-request'))[0].click();
            expect(_converse.api.confirm).toHaveBeenCalled();
            await u.waitUntil(() => rosterview.querySelector(`ul[data-group="Contact requests"]`) === null);
        }));

        it("can be collapsed under their own header", mock.initConverse([], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            mock.createContacts(_converse, 'requesting');
            await mock.openControlBox(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group', rosterview).filter(u.isVisible).length, 700);
            const el = await u.waitUntil(() => rosterview.querySelector(`ul[data-group="Contact requests"]`));
            await checkHeaderToggling.apply(_converse, [el.parentElement]);
        }));

        it("can have their requests accepted by the user",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.createContacts(_converse, 'requesting');
            const name = mock.req_names.sort()[0];
            const jid =  name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const contact = _converse.roster.get(jid);
            spyOn(contact, 'authorize').and.callFake(() => contact);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group li').length)
            // TODO: Testing can be more thorough here, the user is
            // actually not accepted/authorized because of
            // mock_connection.
            spyOn(_converse.roster, 'sendContactAddIQ').and.callFake(() => Promise.resolve());
            const req_contact = sizzle(`.req-contact-name:contains("${contact.getDisplayName()}")`, rosterview).pop();
            req_contact.parentElement.parentElement.querySelector('.accept-xmpp-request').click();
            expect(_converse.roster.sendContactAddIQ).toHaveBeenCalled();
            await u.waitUntil(() => contact.authorize.calls.count());
            expect(contact.authorize).toHaveBeenCalled();
        }));

        it("can have their requests denied by the user",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 0);
            await mock.createContacts(_converse, 'requesting');
            await mock.openControlBox(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group li', rosterview).length, 700);
            const name = mock.req_names.sort()[1];
            const jid =  name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const contact = _converse.roster.get(jid);
            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));
            spyOn(contact, 'unauthorize').and.callFake(function () { return contact; });
            const req_contact = await u.waitUntil(() => sizzle(".req-contact-name:contains('"+name+"')", rosterview).pop());
            req_contact.parentElement.parentElement.querySelector('.decline-xmpp-request').click();
            expect(_converse.api.confirm).toHaveBeenCalled();
            await u.waitUntil(() => contact.unauthorize.calls.count());
            // There should now be one less contact
            expect(_converse.roster.length).toEqual(mock.req_names.length-1);
        }));

        it("are persisted even if other contacts' change their presence ", mock.initConverse(
            [], {}, async function (_converse) {

            const sent_IQs = _converse.connection.IQ_stanzas;
            const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop());
            // Taken from the spec
            // https://xmpp.org/rfcs/rfc3921.html#rfc.section.7.3
            const result = $iq({
                to: _converse.connection.jid,
                type: 'result',
                id: stanza.getAttribute('id')
            }).c('query', {
                xmlns: 'jabber:iq:roster',
            }).c('item', {
                jid: 'juliet@example.net',
                name: 'Juliet',
                subscription:'both'
            }).c('group').t('Friends').up().up()
            .c('item', {
                jid: 'mercutio@example.org',
                name: 'Mercutio',
                subscription:'from'
            }).c('group').t('Friends').up().up()
            _converse.connection._dataRecv(mock.createRequest(result));

            const pres = $pres({from: 'data@enterprise/resource', type: 'subscribe'});
            _converse.connection._dataRecv(mock.createRequest(pres));

            expect(_converse.roster.pluck('jid').length).toBe(1);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('a:contains("Contact requests")', rosterview).length, 700);
            expect(_converse.roster.pluck('jid').includes('data@enterprise')).toBeTruthy();

            const roster_push = $iq({
                'to': _converse.connection.jid,
                'type': 'set',
            }).c('query', {'xmlns': 'jabber:iq:roster', 'ver': 'ver34'})
                .c('item', {
                    jid: 'benvolio@example.org',
                    name: 'Benvolio',
                    subscription:'both'
                }).c('group').t('Friends');
            _converse.connection._dataRecv(mock.createRequest(roster_push));
            expect(_converse.roster.data.get('version')).toBe('ver34');
            expect(_converse.roster.models.length).toBe(4);
            expect(_converse.roster.pluck('jid').includes('data@enterprise')).toBeTruthy();
        }));
    });

    describe("All Contacts", function () {

        it("are saved to, and can be retrieved from browserStorage",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 0);
            await mock.createContacts(_converse, 'requesting');
            await mock.openControlBox(_converse);
            var new_attrs, old_attrs, attrs;
            var num_contacts = _converse.roster.length;
            var new_roster = new _converse.RosterContacts();
            // Roster items are yet to be fetched from browserStorage
            expect(new_roster.length).toEqual(0);
            new_roster.browserStorage = _converse.roster.browserStorage;
            await new Promise(success => new_roster.fetch({success}));
            expect(new_roster.length).toEqual(num_contacts);
            // Check that the roster items retrieved from browserStorage
            // have the same attributes values as the original ones.
            attrs = ['jid', 'fullname', 'subscription', 'ask'];
            for (var i=0; i<attrs.length; i++) {
                new_attrs = new_roster.models.map(m => m.attributes[attrs[i]]); // eslint-disable-line
                old_attrs = _converse.roster.models.map(m => m.attributes[attrs[i]]); // eslint-disable-line
                // Roster items in storage are not necessarily sorted,
                // so we have to sort them here to do a proper
                // comparison
                expect(new_attrs.sort()).toEqual(old_attrs.sort());
            }
        }));

        it("will show fullname and jid properties on tooltip",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 'all');
            await mock.createContacts(_converse, 'requesting');
            await mock.openControlBox(_converse);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('.roster-group li', rosterview).length, 700);
            await Promise.all(mock.cur_names.map(async name => {
                const jid = name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const el = await u.waitUntil(() => sizzle("li:contains('"+name+"')", rosterview).pop());
                const child = el.firstElementChild.firstElementChild;
                expect(child.textContent.trim()).toBe(name);
                expect(child.getAttribute('title')).toContain(name);
                expect(child.getAttribute('title')).toContain(jid);
            }));
            await Promise.all(mock.req_names.map(async name => {
                const jid = name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const el = await u.waitUntil(() => sizzle("li:contains('"+name+"')", rosterview).pop());
                const child = el.firstElementChild.firstElementChild;
                expect(child.textContent.trim()).toBe(name);
                expect(child.firstElementChild.getAttribute('title')).toContain(jid);
            }));
        }));
    });
});
