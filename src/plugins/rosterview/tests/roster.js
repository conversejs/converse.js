/*global mock, converse, _ */

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
    await u.waitUntil(() => group.querySelectorAll('li').length ===
        Array.from(group.querySelectorAll('li')).filter(u.isVisible).length);

    expect(u.hasClass('fa-caret-right', toggle.firstElementChild)).toBeFalsy();
    expect(u.hasClass('fa-caret-down', toggle.firstElementChild)).toBeTruthy();
};


describe("The Contacts Roster", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("verifies the origin of roster pushes", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        // See: https://gultsch.de/gajim_roster_push_and_message_interception.html
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.waitForRoster(_converse, 'current', 1);
        expect(_converse.roster.models.length).toBe(1);
        expect(_converse.roster.at(0).get('jid')).toBe(contact_jid);

        spyOn(converse.env.log, 'warn');
        let roster_push = stx`
            <iq type="set" to="${_converse.jid}" from="eve@siacs.eu" xmlns="jabber:client">
                <query xmlns='jabber:iq:roster'>
                    <item subscription="remove" jid="${contact_jid}"/>
                </query>
            </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(roster_push));
        expect(converse.env.log.warn.calls.count()).toBe(1);
        expect(converse.env.log.warn).toHaveBeenCalledWith(
            `Ignoring roster illegitimate roster push message from eve@siacs.eu`
        );
        roster_push = stx`
            <iq type="set" to="${_converse.jid}" from="eve@siacs.eu" xmlns="jabber:client">
                <query xmlns='jabber:iq:roster'>
                    <item subscription="both" jid="eve@siacs.eu" name="${mock.cur_names[0]}" />
                </query>
            </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(roster_push));
        expect(converse.env.log.warn.calls.count()).toBe(2);
        expect(converse.env.log.warn).toHaveBeenCalledWith(
            `Ignoring roster illegitimate roster push message from eve@siacs.eu`
        );
        expect(_converse.roster.models.length).toBe(1);
        expect(_converse.roster.at(0).get('jid')).toBe(contact_jid);
    }));

    it("is populated once we have registered a presence handler", mock.initConverse([], {}, async function (_converse) {
        const IQs = _converse.api.connection.get().IQ_stanzas;
        const stanza = await u.waitUntil(
            () => IQs.filter(iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop());

        expect(stanza).toEqualStanza(
            stx`<iq id="${stanza.getAttribute('id')}" type="get" xmlns="jabber:client">
                <query xmlns="jabber:iq:roster"/>
            </iq>`);
        const result = stx`
            <iq to="${_converse.api.connection.get().jid}" type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                <query xmlns="jabber:iq:roster">
                    <item jid="nurse@example.com"/>
                    <item jid="romeo@example.com"/>
                </query>
            </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(result));
        await u.waitUntil(() => _converse.promises['rosterContactsFetched'].isResolved === true);
    }));

    it("supports roster versioning", mock.initConverse([], {}, async function (_converse) {
        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        let stanza = await u.waitUntil(
            () => IQ_stanzas.filter(iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop()
        );
        expect(_converse.roster.data.get('version')).toBeUndefined();
        expect(Strophe.serialize(stanza)).toBe(
            `<iq id="${stanza.getAttribute('id')}" type="get" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"/>`+
            `</iq>`);
        let result = stx`
            <iq to="${_converse.api.connection.get().jid}" type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                <query xmlns="jabber:iq:roster" ver="ver7">
                    <item jid="nurse@example.com"/>
                    <item jid="romeo@example.com"/>
                </query>
            </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(result));

        await u.waitUntil(() => _converse.roster.models.length > 1);
        expect(_converse.roster.data.get('version')).toBe('ver7');
        expect(_converse.roster.models.length).toBe(2);

        _converse.roster.fetchFromServer();
        stanza = _converse.api.connection.get().IQ_stanzas.pop();
        expect(Strophe.serialize(stanza)).toBe(
            `<iq id="${stanza.getAttribute('id')}" type="get" xmlns="jabber:client">`+
                `<query ver="ver7" xmlns="jabber:iq:roster"/>`+
            `</iq>`);

        result = stx`
            <iq to="${_converse.api.connection.get().jid}" type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
            </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(result));

        const roster_push = stx`
            <iq type="set" to="${_converse.api.connection.get().jid}" xmlns="jabber:client">
                <query xmlns='jabber:iq:roster' ver='ver34'>
                    <item jid='romeo@example.com' subscription='remove'/>
                </query>
            </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(roster_push));
        expect(_converse.roster.data.get('version')).toBe('ver34');
        expect(_converse.roster.models.length).toBe(1);
        expect(_converse.roster.at(0).get('jid')).toBe('nurse@example.com');
    }));

    it("also contains contacts with subscription of none", mock.initConverse(
        [], {}, async function (_converse) {

        const sent_IQs = _converse.api.connection.get().IQ_stanzas;
        const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop());
        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq to="${_converse.api.connection.get().jid}" type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                <query xmlns="jabber:iq:roster">
                    <item jid="juliet@example.net" name="Juliet" subscription="both">
                        <group>Friends</group>
                    </item>
                    <item jid="mercutio@example.net" name="Mercutio" subscription="from">
                        <group>Friends</group>
                    </item>
                    <item jid="lord.capulet@example.net" name="Lord Capulet" subscription="none">
                        <group>Acquaintences</group>
                    </item>
                </query>
            </iq>
        `));

        while (sent_IQs.length) sent_IQs.pop();

        await u.waitUntil(() => _converse.roster.length === 3);
        expect(_converse.roster.pluck('jid')).toEqual(['juliet@example.net', 'mercutio@example.net', 'lord.capulet@example.net']);
        expect(_converse.roster.get('lord.capulet@example.net').get('subscription')).toBe('none');
    }));

    it("can be refreshed if loglevel is set to debug", mock.initConverse(
        [], {loglevel: 'debug'}, async function (_converse) {

        const sent_IQs = _converse.api.connection.get().IQ_stanzas;
        let stanza = await u.waitUntil(
            () => sent_IQs.filter(iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop());

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq to="${_converse.api.connection.get().jid}" type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                <query xmlns="jabber:iq:roster">
                    <item jid="juliet@example.net" name="Juliet" subscription="both">
                        <group>Friends</group>
                    </item>
                    <item jid="mercutio@example.net" name="Mercutio" subscription="from">
                        <group>Friends</group>
                    </item>
                </query>
            </iq>
        `));

        while (sent_IQs.length) sent_IQs.pop();

        await u.waitUntil(() => _converse.roster.length === 2);
        expect(_converse.roster.pluck('jid')).toEqual(['juliet@example.net', 'mercutio@example.net']);
        await mock.openControlBox(_converse);

        const rosterview = document.querySelector('converse-roster');

        const dropdown = await u.waitUntil(
            () => rosterview.querySelector('.dropdown--contacts')
        );
        const sync_button = dropdown.querySelector('.sync-contacts');
        sync_button.click();

        stanza = await u.waitUntil(
            () => sent_IQs.filter(iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop()
        );

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq to="${_converse.api.connection.get().jid}" type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                <query xmlns="jabber:iq:roster">
                    <item jid="juliet@example.net" name="Juliet" subscription="both">
                        <group>Friends</group>
                    </item>
                    <item jid="lord.capulet@example.net" name="Lord Capulet" subscription="from">
                        <group>Acquaintences</group>
                    </item>
                </query>
            </iq>
        `));

        await u.waitUntil(() => _converse.roster.pluck('jid').includes('lord.capulet@example.net'));
        expect(_converse.roster.pluck('jid')).toEqual(['juliet@example.net', 'lord.capulet@example.net']);
    }));

    it("will also show contacts added afterwards", mock.initConverse([], {}, async function (_converse) {
        await mock.openControlBox(_converse);
        await mock.waitForRoster(_converse, 'current');

        const rosterview = document.querySelector('converse-roster');
        const roster = rosterview.querySelector('.roster-contacts');

        const dropdown = await u.waitUntil(
            () => rosterview.querySelector('.dropdown--contacts')
        );
        dropdown.querySelector('.toggle-filter').click();

        const filter = await u.waitUntil(() => rosterview.querySelector('.items-filter'));
        await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 18), 800);
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

        it("will only be an option when there are more than 5 contacts",
                mock.initConverse([], { show_self_in_roster: false }, async function (_converse) {

            expect(document.querySelector('converse-roster')).toBe(null);
            await mock.waitForRoster(_converse, 'current', 5);
            await mock.openControlBox(_converse);

            const view = _converse.chatboxviews.get('controlbox');
            const dropdown = await u.waitUntil(
                () => view.querySelector('.dropdown--contacts')
            );
            expect(dropdown.querySelector('.toggle-filter')).toBe(null);

            mock.createContact(_converse, 'Slowpoke', 'subscribe');
            const el = await u.waitUntil(() => dropdown.querySelector('.toggle-filter'));
            expect(el).toBeDefined();

            el.click();
            await u.waitUntil(() => view.querySelector('.roster-contacts converse-list-filter'));
        }));

        it("can be used to filter the contacts shown",
            mock.initConverse(
                [], {'roster_groups': true},
                async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current');
            const rosterview = document.querySelector('converse-roster');
            const roster = rosterview.querySelector('.roster-contacts');

            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 18), 600);
            expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(5);

            const filter_toggle = await u.waitUntil(() => rosterview.querySelector('.toggle-filter'));
            filter_toggle.click();

            let filter = await u.waitUntil(() => rosterview.querySelector('.items-filter'));
            filter.value = "juliet";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");
            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 1), 600);
            // Only one roster contact is now visible
            let visible_contacts = sizzle('li', roster).filter(u.isVisible);
            expect(visible_contacts.length).toBe(1);
            expect(visible_contacts.pop().querySelector('.contact-name').textContent.trim()).toBe('Juliet Capulet');

            // Only one foster group is still visible
            expect(sizzle('.roster-group', roster).filter(u.isVisible).length).toBe(1);
            const visible_group = sizzle('.roster-group', roster).filter(u.isVisible).pop();
            expect(visible_group.querySelector('a.group-toggle').textContent.trim()).toBe('friends & acquaintences');

            filter = rosterview.querySelector('.items-filter');
            filter.value = "j";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");
            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 2), 700);

            visible_contacts = sizzle('li', roster).filter(u.isVisible);
            expect(visible_contacts.length).toBe(2);

            let visible_groups = sizzle('.roster-group', roster).filter(u.isVisible).map(el => el.querySelector('a.group-toggle'));
            expect(visible_groups.length).toBe(2);
            expect(visible_groups[0].textContent.trim()).toBe('friends & acquaintences');
            expect(visible_groups[1].textContent.trim()).toBe('Ungrouped');

            filter = rosterview.querySelector('.items-filter');
            filter.value = "xxx";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");
            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 0), 600);
            visible_groups = sizzle('.roster-group', roster).filter(u.isVisible).map(el => el.querySelector('a.group-toggle'));
            expect(visible_groups.length).toBe(0);

            filter = rosterview.querySelector('.items-filter');
            filter.value = "";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");
            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 18), 600);
            expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(5);
        }));

        it("can be used to filter the groups shown", mock.initConverse([], {'roster_groups': true}, async function (_converse) {
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current');
            const rosterview = document.querySelector('converse-roster');
            const roster = rosterview.querySelector('.roster-contacts');

            const filter_toggle = await u.waitUntil(() => rosterview.querySelector('.toggle-filter'));
            filter_toggle.click();

            const button =  await u.waitUntil(() => rosterview.querySelector('converse-icon[data-type="groups"]'));
            button.click();

            await u.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 18), 600);
            expect(sizzle('.roster-group', roster).filter(u.isVisible).length).toBe(5);

            let filter = rosterview.querySelector('.items-filter');
            filter.value = "colleagues";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");

            await u.waitUntil(() => (sizzle('div.roster-group:not(.collapsed)', roster).length === 1), 600);
            expect(sizzle('div.roster-group:not(.collapsed)', roster).pop().firstElementChild.textContent.trim()).toBe('Colleagues');
            expect(sizzle('div.roster-group:not(.collapsed) li', roster).filter(u.isVisible).length).toBe(6);
            // Check that all contacts under the group are shown
            expect(sizzle('div.roster-group:not(.collapsed) li', roster).filter(l => !u.isVisible(l)).length).toBe(0);

            filter = rosterview.querySelector('.items-filter');
            filter.value = "xxx";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");

            await u.waitUntil(() => (roster.querySelectorAll('.roster-group').length === 0), 700);

            filter = rosterview.querySelector('.items-filter');
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

            const filter_toggle = await u.waitUntil(() => rosterview.querySelector('.toggle-filter'));
            filter_toggle.click();

            const filter = await u.waitUntil(() => rosterview.querySelector('.items-filter'));
            filter.value = "xxx";
            u.triggerEvent(filter, "keydown", "KeyboardEvent");
            expect(filter.classList.contains("x")).toBeFalsy();
            expect(u.hasClass('hidden', rosterview.querySelector('.items-filter-form .clear-input'))).toBeTruthy();

            const isHidden = (el) => u.hasClass('hidden', el);
            await u.waitUntil(() => !isHidden(rosterview.querySelector('.items-filter-form .clear-input')), 900);
            rosterview.querySelector('.clear-input').click();
            await u.waitUntil(() => document.querySelector('.items-filter').value == '');
        }));

        it("can be used to filter contacts by their chat state",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'all');

            let jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            _converse.roster.get(jid).presence.set('show', 'online');
            jid = mock.cur_names[4].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            _converse.roster.get(jid).presence.set('show', 'dnd');
            await mock.openControlBox(_converse);
            const rosterview = document.querySelector('converse-roster');

            const filter_toggle = await u.waitUntil(() => rosterview.querySelector('.toggle-filter'));
            filter_toggle.click();

            const button = await u.waitUntil(() => rosterview.querySelector('converse-icon[data-type="state"]'));
            button.click();

            const filter = rosterview.querySelector('.state-type');
            filter.value = "";
            u.triggerEvent(filter, 'change');

            const roster = rosterview.querySelector('.roster-contacts');
            await u.waitUntil(() => sizzle('li', roster).filter(u.isVisible).length === 21, 900);
            expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(5);

            filter.value = "online";
            u.triggerEvent(filter, 'change');

            await u.waitUntil(() => sizzle('li', roster).filter(u.isVisible).length === 2, 900);
            const contacts = sizzle('li', roster).filter(u.isVisible);
            expect(contacts.pop().querySelector('.contact-name').textContent.trim()).toBe('Romeo Montague (me)');
            expect(contacts.pop().querySelector('.contact-name').textContent.trim()).toBe('Lord Montague');

            const groups = sizzle('ul.roster-group-contacts', roster).filter(u.isVisible);
            expect(groups.pop().parentElement.firstElementChild.textContent.trim()).toBe('Ungrouped');
            expect(groups.pop().parentElement.firstElementChild.textContent.trim()).toBe('Family');

            filter.value = "dnd";
            u.triggerEvent(filter, 'change');

            await u.waitUntil(() => sizzle('li', roster).filter(u.isVisible).pop().querySelector('.contact-name').textContent.trim() === 'Friar Laurence', 900);
            const ul = sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).pop();
            expect(ul.parentElement.firstElementChild.textContent.trim()).toBe('friends & acquaintences');
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
                "Ungrouped",
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
                "Ungrouped",
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
                const sorted_names = [...names];
                sorted_names.sort();
                expect(names).toEqual(sorted_names);
            });
        }));

        it("gets created when a contact's \"groups\" attribute changes",
            mock.initConverse([], {roster_groups: true, show_self_in_roster: false}, async function (_converse) {

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
            await u.waitUntil(() => (sizzle('li', rosterview).filter(u.isVisible).length === 31));
            // Check that usernames appear alphabetically per group
            groups.forEach(name => {
                const contacts = sizzle('.roster-group[data-group="'+name+'"] ul li', rosterview);
                const names = contacts.map(o => o.textContent.trim());
                const sorted_names = [...names];
                sorted_names.sort();
                expect(names).toEqual(sorted_names);
                expect(names.length).toEqual(mock.cur_names.length);
            });
        }));

        it("remembers whether it is closed or opened",
                mock.initConverse([], { show_self_in_roster: false }, async function (_converse) {

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
            expect(sizzle('li', rosterview).filter(u.isVisible).length).toBe(4);
            expect(sizzle('ul.roster-group-contacts', rosterview).filter(u.isVisible).length).toBe(1);
            const el = sizzle('ul.roster-group-contacts', rosterview).filter(u.isVisible).pop();
            expect(el.getAttribute('data-group')).toBe('Ungrouped');
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
            spyOn(contact, 'sendRosterRemoveStanza').and.callThrough();
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle(`.pending-xmpp-contact .contact-name:contains("${name}")`, rosterview).length, 500);
            let sent_IQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback) {
                sent_IQ = iq;
                callback();
            });
            sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, rosterview).pop().click();
            await u.waitUntil(() => !sizzle(`.pending-xmpp-contact .contact-name:contains("${name}")`, rosterview).length, 500);
            expect(_converse.api.confirm).toHaveBeenCalled();
            expect(contact.sendRosterRemoveStanza).toHaveBeenCalled();
            expect(sent_IQ).toEqualStanza(stx`
                <iq type="set" xmlns="jabber:client">
                    <query xmlns="jabber:iq:roster">
                        <item jid="lord.capulet@montague.lit" subscription="remove"/>
                    </query>
                </iq>`);
        }));

        it("can be removed by the user",
                mock.initConverse(
                    [],
                    {'roster_groups': false},
                    async function (_converse) {

            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'pending');
            await Promise.all(_converse.roster.map(contact => u.waitUntil(() => contact.vcard.get('fullname'))));
            await u.waitUntil(() => _converse.roster.at(0).vcard.get('fullname'))
            const rosterview = document.querySelector('converse-roster');

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;

            for (let i=0; i<mock.pend_names.length; i++) {
                const name = mock.pend_names[i];
                const jid = name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const el = rosterview.querySelector(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`);
                el.click();
                const stanza = await u.waitUntil(() => sent_IQs.find(iq => iq.querySelector('iq item[subscription="remove"]')));
                expect(stanza).toEqualStanza(
                    stx`<iq type="set" xmlns="jabber:client" id="${stanza.getAttribute('id')}">
                        <query xmlns="jabber:iq:roster"><item jid="${jid}" subscription="remove"/></query>
                    </iq>`);
                _converse.api.connection.get()._dataRecv(mock.createRequest(
                    stx`<iq id="${stanza.getAttribute('id')}" type="result" xmlns="jabber:client"></iq>`));
                while (sent_IQs.length) sent_IQs.pop();
            }
            await u.waitUntil(() => rosterview.querySelector(`ul[data-group="Pending contacts"]`) === null);
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
                [], { roster_groups: false, show_self_in_roster: false },
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
            await u.waitUntil(() => u.hasClass('collapsed', rosterview.querySelector(`ul[data-group="Colleagues"]`)) === true);
            expect(true).toBe(true);
        }));

        it("will have their online statuses shown correctly",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const icon_el = document.querySelector('converse-roster-contact converse-icon');
            expect(icon_el.getAttribute('color')).toBe('var(--comment)');

            let pres = $pres({from: 'mercutio@montague.lit/resource'});
            _converse.api.connection.get()._dataRecv(mock.createRequest(pres));
            await u.waitUntil(() => icon_el.getAttribute('color') === 'var(--chat-status-online)');

            pres = $pres({from: 'mercutio@montague.lit/resource'}).c('show', 'away');
            _converse.api.connection.get()._dataRecv(mock.createRequest(pres));
            await u.waitUntil(() => icon_el.getAttribute('color') === 'var(--chat-status-away)');

            pres = $pres({from: 'mercutio@montague.lit/resource'}).c('show', 'xa');
            _converse.api.connection.get()._dataRecv(mock.createRequest(pres));
            await u.waitUntil(() => icon_el.getAttribute('color') === 'var(--comment)');

            pres = $pres({from: 'mercutio@montague.lit/resource'}).c('show', 'dnd');
            _converse.api.connection.get()._dataRecv(mock.createRequest(pres));
            await u.waitUntil(() => icon_el.getAttribute('color') === 'var(--chat-status-busy)');

            pres = $pres({from: 'mercutio@montague.lit/resource', type: 'unavailable'});
            _converse.api.connection.get()._dataRecv(mock.createRequest(pres));
            await u.waitUntil(() => icon_el.getAttribute('color') === 'var(--comment)');
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
            const els = sizzle('.current-xmpp-contact.offline a.open-chat .contact-name', rosterview)
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
            spyOn(contact, 'sendRosterRemoveStanza').and.callThrough();

            let sent_IQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake((iq, callback) => {
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
            expect(contact.sendRosterRemoveStanza).toHaveBeenCalled();
            await u.waitUntil(() => sizzle(".open-chat:contains('"+name+"')", rosterview).length === 0);
        }));

        it("do not have a header if there aren't any",
            mock.initConverse(
                [], { show_self_in_roster: false },
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
            spyOn(contact, 'sendRosterRemoveStanza').and.callThrough();
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake((_iq, callback) => callback?.());
            expect(u.isVisible(rosterview.querySelector('.roster-group'))).toBe(true);
            sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, rosterview).pop().click();
            expect(_converse.api.confirm).toHaveBeenCalled();
            await u.waitUntil(() => _converse.api.connection.get().sendIQ.calls.count());
            expect(contact.sendRosterRemoveStanza).toHaveBeenCalled();
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length === 0);
        }));

        it("can change their status to online and be sorted alphabetically",
            mock.initConverse(
                [], { show_self_in_roster: false },
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
                [], { show_self_in_roster: false },
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

            await u.waitUntil(() => u.isVisible(rosterview.querySelector('li.list-item:first-child')));
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
            const children = rosterview.querySelectorAll(`ul[data-group="Contact requests"] .requesting-xmpp-contact .contact-name`);
            names = [];
            Array.from(children).forEach(addName);
            expect(names.join('')).toEqual(mock.req_names.slice(0,mock.req_names.length+1).sort().join(''));
        }));

        it("do not have a header if there aren't any",
                mock.initConverse([], { show_self_in_roster: false }, async function (_converse) {
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, "current", 0);
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.domain,
                [{ 'category': 'server', 'type': 'IM' }],
                ['urn:xmpp:blocking']
            );

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

            await u.waitUntil(() => _converse.api.confirm.calls.count);
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
            const { api, roster } = _converse;
            const contact = roster.get(jid);
            spyOn(contact, 'authorize').and.callThrough();
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group li').length)

            const req_contact = sizzle(`.contact-name:contains("${contact.getDisplayName()}")`, rosterview).pop();
            req_contact.parentElement.parentElement.querySelector('.accept-xmpp-request').click();

            const modal = _converse.api.modal.get('converse-accept-contact-request-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);

            expect(modal.querySelector('input[name="name"]')?.value).toBe('Escalus, prince of Verona');
            const group_input = modal.querySelector('input[name="group"]');
            group_input.value = 'Princes';

            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
            while (sent_stanzas.length) sent_stanzas.pop();

            modal.querySelector('button[type="submit"]').click();

            let stanza = await u.waitUntil(() => sent_stanzas.filter(s => s.matches('iq[type="set"]')).pop());
            expect(stanza).toEqualStanza(
                stx`<iq type="set" xmlns="jabber:client" id="${stanza.getAttribute('id')}">
                        <query xmlns="jabber:iq:roster">
                            <item jid="${contact.get('jid')}" name="Escalus, prince of Verona"/>
                        </query>
                    </iq>`);

            const result = stx`
                <iq to="${api.connection.get().jid}" type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client"/>`;
            api.connection.get()._dataRecv(mock.createRequest(result));

            stanza = await u.waitUntil(() => sent_stanzas.filter(s => s.matches('presence[type="subscribed"]')).pop());
            expect(stanza).toEqualStanza(
                stx`<presence to="${contact.get('jid')}" type="subscribed" xmlns="jabber:client"/>`);

            await u.waitUntil(() => contact.authorize.calls.count());
            expect(contact.authorize).toHaveBeenCalled();
            expect(contact.get('groups')).toEqual(['Princes']);
        }));

        it("can have their requests denied by the user",
            mock.initConverse(
                [], {},
                async function (_converse) {

            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.domain,
                [{ 'category': 'server', 'type': 'IM' }],
                ['urn:xmpp:blocking']
            );
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
            const req_contact = await u.waitUntil(() => sizzle(".contact-name:contains('"+name+"')", rosterview).pop());
            req_contact.parentElement.parentElement.querySelector('.decline-xmpp-request').click();
            await u.waitUntil(() => _converse.api.confirm.calls.count);
            await u.waitUntil(() => contact.unauthorize.calls.count());
            // There should now be one less contact
            expect(_converse.roster.length).toEqual(mock.req_names.length-1);
        }));

        it("are persisted even if other contacts' change their presence ", mock.initConverse(
            [], {}, async function (_converse) {

            await mock.openControlBox(_converse);

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop());
            // Taken from the spec
            // https://xmpp.org/rfcs/rfc3921.html#rfc.section.7.3
            const result = stx`
                <iq to="${_converse.api.connection.get().jid}" type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                    <query xmlns="jabber:iq:roster">
                        <item jid="juliet@example.net" name="Juliet" subscription="both">
                            <group>Friends</group>
                        </item>
                        <item jid="mercutio@example.org" name="Mercutio" subscription="from">
                            <group>Friends</group>
                        </item>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));

            const pres = $pres({from: 'data@enterprise/resource', type: 'subscribe'});
            _converse.api.connection.get()._dataRecv(mock.createRequest(pres));

            expect(_converse.roster.pluck('jid').length).toBe(1);
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => sizzle('a:contains("Contact requests")', rosterview).length, 700);
            expect(_converse.roster.pluck('jid').includes('data@enterprise')).toBeTruthy();

            const roster_push = stx`
                <iq type="set" to="${_converse.api.connection.get().jid}" xmlns="jabber:client">
                    <query xmlns="jabber:iq:roster" ver="ver34">
                        <item jid="benvolio@example.org" name="Benvolio" subscription="both">
                            <group>Friends</group>
                        </item>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(roster_push));
            expect(_converse.roster.data.get('version')).toBe('ver34');
            expect(_converse.roster.models.length).toBe(4);
            expect(_converse.roster.pluck('jid').includes('data@enterprise')).toBeTruthy();
        }));
    });

    describe("An unsaved Contact", function () {

        it("is shown upon receiving a message",
            mock.initConverse(
                [], {},
                async function (_converse) {

            const { api } = _converse;
            await mock.waitUntilBlocklistInitialized(_converse);
            await mock.waitForRoster(_converse, "current", 0);
            await mock.openControlBox(_converse);

            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const msg = stx`
                <message xmlns='jabber:client'
                        id='${api.connection.get().getUniqueId()}'
                        to='${_converse.bare_jid}'
                        from='${sender_jid}'
                        type='chat'>
                    <body>Hello</body>
                </message>`;
            await _converse.handleMessageStanza(msg);

            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length);
            expect(rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length).toBe(1);
            const el = rosterview.querySelector(`ul[data-group="Unsaved contacts"] li .contact-name`);
            expect(el.textContent).toBe('Mercutio');
        }));

        it("is shown upon receiving a message to a previously removed contact",
            mock.initConverse(
                [], {},
                async function (_converse) {

            const { api } = _converse;
            await mock.waitUntilBlocklistInitialized(_converse);
            await mock.waitForRoster(_converse, "current", 1);
            await mock.openControlBox(_converse);

            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            let msg = stx`
                <message xmlns='jabber:client'
                        id='${api.connection.get().getUniqueId()}'
                        to='${_converse.bare_jid}'
                        from='${sender_jid}'
                        type='chat'>
                    <body>Hello</body>
                </message>`;
            await _converse.handleMessageStanza(msg);

            spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));

            const rosterview = document.querySelector('converse-roster');
            rosterview.querySelector(`.remove-xmpp-contact`).click();
            expect(_converse.api.confirm).toHaveBeenCalled();

            msg = stx`
                <message xmlns='jabber:client'
                        id='${api.connection.get().getUniqueId()}'
                        to='${_converse.bare_jid}'
                        from='${sender_jid}'
                        type='chat'>
                    <body>Why did you remove me?</body>
                </message>`;
            await _converse.handleMessageStanza(msg);

            await u.waitUntil(() => rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length);
            expect(rosterview.querySelectorAll(`ul[data-group="Unsaved contacts"] li`).length).toBe(1);
            const el = rosterview.querySelector(`ul[data-group="Unsaved contacts"] li .contact-name`);
            expect(el.textContent).toBe('Mercutio');
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
                expect(el.querySelector('.contact-name').textContent.trim()).toBe(name);
                const child = el.firstElementChild.firstElementChild;
                expect(child.getAttribute('title')).toContain(name);
                expect(child.getAttribute('title')).toContain(jid);
            }));
            await Promise.all(mock.req_names.map(async name => {
                const el = await u.waitUntil(() => sizzle("li:contains('"+name+"')", rosterview).pop());
                const child = el.querySelector('.contact-name');
                expect(child.textContent.trim()).toBe(name);
            }));
        }));
    });
});
