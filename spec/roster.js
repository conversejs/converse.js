(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    const $iq = converse.env.$iq;
    const $msg = converse.env.$msg;
    const $pres = converse.env.$pres;
    const Strophe = converse.env.Strophe;
    const _ = converse.env._;
    const sizzle = converse.env.sizzle;
    const u = converse.env.utils;


    const checkHeaderToggling = async function (group) {
        const toggle = group.querySelector('a.group-toggle');
        expect(u.isVisible(group)).toBeTruthy();
        expect(group.querySelectorAll('ul.collapsed').length).toBe(0);
        expect(u.hasClass('fa-caret-right', toggle.firstElementChild)).toBeFalsy();
        expect(u.hasClass('fa-caret-down', toggle.firstElementChild)).toBeTruthy();
        toggle.click();

        await test_utils.waitUntil(() => group.querySelectorAll('ul.collapsed').length === 1);
        expect(u.hasClass('fa-caret-right', toggle.firstElementChild)).toBeTruthy();
        expect(u.hasClass('fa-caret-down', toggle.firstElementChild)).toBeFalsy();
        toggle.click();
        await test_utils.waitUntil(() => group.querySelectorAll('li').length === _.filter(group.querySelectorAll('li'), u.isVisible).length);
        expect(u.hasClass('fa-caret-right', toggle.firstElementChild)).toBeFalsy();
        expect(u.hasClass('fa-caret-down', toggle.firstElementChild)).toBeTruthy();
    };


    describe("The Contacts Roster", function () {

        it("is populated once we have registered a presence handler",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            spyOn(_converse.api, "trigger").and.callThrough();
            const IQs = _converse.connection.IQ_stanzas;
            const node = await test_utils.waitUntil(
                () => _.filter(IQs, iq => iq.nodeTree.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop());
            expect(_converse.api.trigger.calls.all().map(c => c.args[0]).includes('rosterContactsFetched')).toBeFalsy();

            expect(node.toLocaleString()).toBe(
                `<iq id="${node.nodeTree.getAttribute('id')}" type="get" xmlns="jabber:client">`+
                    `<query xmlns="jabber:iq:roster"/>`+
                `</iq>`);
            const result = $iq({
                'to': _converse.connection.jid,
                'type': 'result',
                'id': node.nodeTree.getAttribute('id')
            }).c('query', {
                'xmlns': 'jabber:iq:roster'
            }).c('item', {'jid': 'nurse@example.com'}).up()
              .c('item', {'jid': 'romeo@example.com'})
            _converse.connection._dataRecv(test_utils.createRequest(result));
            await test_utils.waitUntil(() => _converse.api.trigger.calls.all().map(c => c.args[0]).includes('rosterContactsFetched'));
            done();
        }));

        it("supports roster versioning",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const IQ_stanzas = _converse.connection.IQ_stanzas;
            let node = await test_utils.waitUntil(
                () => _.filter(IQ_stanzas, iq => iq.nodeTree.querySelector('iq query[xmlns="jabber:iq:roster"]')).pop()
            );
            let stanza = node.nodeTree;
            expect(_converse.roster.data.get('version')).toBeUndefined();
            expect(node.toLocaleString()).toBe(
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
            _converse.connection._dataRecv(test_utils.createRequest(result));

            await test_utils.waitUntil(() => _converse.roster.models.length > 1);
            expect(_converse.roster.data.get('version')).toBe('ver7');
            expect(_converse.roster.models.length).toBe(2);

            _converse.roster.fetchFromServer();
            node = _converse.connection.IQ_stanzas.pop();
            stanza = node.nodeTree;
            expect(node.toLocaleString()).toBe(
                `<iq id="${stanza.getAttribute('id')}" type="get" xmlns="jabber:client">`+
                    `<query ver="ver7" xmlns="jabber:iq:roster"/>`+
                `</iq>`);

            result = $iq({
                'to': _converse.connection.jid,
                'type': 'result',
                'id': stanza.getAttribute('id')
            });
            _converse.connection._dataRecv(test_utils.createRequest(result));

            const roster_push = $iq({
                'to': _converse.connection.jid,
                'type': 'set',
            }).c('query', {'xmlns': 'jabber:iq:roster', 'ver': 'ver34'})
                .c('item', {'jid': 'romeo@example.com', 'subscription': 'remove'});
            _converse.connection._dataRecv(test_utils.createRequest(roster_push));
            expect(_converse.roster.data.get('version')).toBe('ver34');
            expect(_converse.roster.models.length).toBe(1);
            expect(_converse.roster.at(0).get('jid')).toBe('nurse@example.com');
            done();
        }));

        describe("The live filter", function () {

            it("will only appear when roster contacts flow over the visible area",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                var filter = _converse.rosterview.el.querySelector('.roster-filter');
                var names = mock.cur_names;
                test_utils.openControlBox();
                _converse.rosterview.update(); // XXX: Will normally called as event handler
                expect(_.isNull(filter)).toBe(false);
                await test_utils.waitUntil(() => !u.isVisible(filter));
                for (var i=0; i<names.length; i++) {
                    _converse.roster.create({
                        ask: null,
                        fullname: names[i],
                        jid: names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                        requesting: 'false',
                        subscription: 'both'
                    });
                    _converse.rosterview.update(); // XXX: Will normally called as event handler
                }

                function hasScrollBar (el) {
                    return el.isConnected && el.parentElement.offsetHeight < el.scrollHeight;
                }

                await test_utils.waitUntil(function () {
                    if (hasScrollBar(_converse.rosterview.roster_el)) {
                        return u.isVisible(filter);
                    } else {
                        return !u.isVisible(filter);
                    }
                });
                done();
            }));

            it("can be used to filter the contacts shown",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {'roster_groups': true},
                    async function (done, _converse) {

                test_utils.openControlBox();
                test_utils.createGroupedContacts(_converse);
                let filter = _converse.rosterview.el.querySelector('.roster-filter');
                const roster = _converse.rosterview.roster_el;
                _converse.rosterview.filter_view.delegateEvents();

                const contacts = await test_utils.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 15), 600);
                expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(5);
                filter.value = "candice";
                u.triggerEvent(filter, "keydown", "KeyboardEvent");
                await test_utils.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 1), 600);
                // Only one roster contact is now visible
                let visible_contacts = sizzle('li', roster).filter(u.isVisible);
                expect(visible_contacts.length).toBe(1);
                expect(visible_contacts.pop().textContent.trim()).toBe('Candice van der Knijff');
                // Only one foster group is still visible
                expect(sizzle('.roster-group', roster).filter(u.isVisible).length).toBe(1);
                const visible_group = sizzle('.roster-group', roster).filter(u.isVisible).pop();
                expect(visible_group.querySelector('a.group-toggle').textContent.trim()).toBe('colleagues');

                filter = _converse.rosterview.el.querySelector('.roster-filter');
                filter.value = "an";
                u.triggerEvent(filter, "keydown", "KeyboardEvent");
                await test_utils.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 5), 600);

                visible_contacts = sizzle('li', roster).filter(u.isVisible);
                expect(visible_contacts.length).toBe(5);

                let visible_groups = sizzle('.roster-group', roster).filter(u.isVisible).map(el => el.querySelector('a.group-toggle'));
                expect(visible_groups.length).toBe(4);
                expect(visible_groups[0].textContent.trim()).toBe('colleagues');
                expect(visible_groups[1].textContent.trim()).toBe('Family');
                expect(visible_groups[2].textContent.trim()).toBe('friends & acquaintences');
                expect(visible_groups[3].textContent.trim()).toBe('ænemies');

                filter = _converse.rosterview.el.querySelector('.roster-filter');
                filter.value = "xxx";
                u.triggerEvent(filter, "keydown", "KeyboardEvent");
                await test_utils.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 0), 600);
                visible_groups = sizzle('.roster-group', roster).filter(u.isVisible).map(el => el.querySelector('a.group-toggle'));
                expect(visible_groups.length).toBe(0);

                filter = _converse.rosterview.el.querySelector('.roster-filter');
                filter.value = "";
                u.triggerEvent(filter, "keydown", "KeyboardEvent");
                await test_utils.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 15), 600);
                expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(5);
                done();
            }));

            it("will also filter out contacts added afterwards",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.openControlBox();
                test_utils.createGroupedContacts(_converse);

                const filter = _converse.rosterview.el.querySelector('.roster-filter');
                const roster = _converse.rosterview.roster_el;
                _converse.rosterview.filter_view.delegateEvents();

                await test_utils.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 15), 600);
                filter.value = "an";
                u.triggerEvent(filter, "keydown", "KeyboardEvent");
                await test_utils.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 5), 600);

                // Five roster contact is now visible
                const visible_contacts = sizzle('li', roster).filter(u.isVisible);
                expect(visible_contacts.length).toBe(5);
                let visible_groups = sizzle('.roster-group', roster).filter(u.isVisible).map(el => el.querySelector('a.group-toggle'));
                expect(visible_groups.length).toBe(4);
                expect(visible_groups[0].textContent.trim()).toBe('colleagues');
                expect(visible_groups[1].textContent.trim()).toBe('Family');
                expect(visible_groups[2].textContent.trim()).toBe('friends & acquaintences');
                expect(visible_groups[3].textContent.trim()).toBe('ænemies');

                _converse.roster.create({
                    jid: 'latecomer@localhost',
                    subscription: 'both',
                    ask: null,
                    groups: ['newgroup'],
                    fullname: 'Marty McLatecomer'
                });
                await test_utils.waitUntil(() => sizzle('.roster-group[data-group="newgroup"] li', roster).length, 300);
                visible_groups = sizzle('.roster-group', roster).filter(u.isVisible).map(el => el.querySelector('a.group-toggle'));
                // The "newgroup" group doesn't appear
                expect(visible_groups.length).toBe(4);
                expect(visible_groups[0].textContent.trim()).toBe('colleagues');
                expect(visible_groups[1].textContent.trim()).toBe('Family');
                expect(visible_groups[2].textContent.trim()).toBe('friends & acquaintences');
                expect(visible_groups[3].textContent.trim()).toBe('ænemies');
                expect(roster.querySelectorAll('.roster-group').length).toBe(6);
                done();
            }));

            it("can be used to filter the groups shown",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {'roster_groups': true},
                    async function (done, _converse) {

                test_utils.openControlBox();
                test_utils.createGroupedContacts(_converse);
                _converse.rosterview.filter_view.delegateEvents();
                var roster = _converse.rosterview.roster_el;

                var button = _converse.rosterview.el.querySelector('span[data-type="groups"]');
                button.click();

                const contacts = await test_utils.waitUntil(() => (sizzle('li', roster).filter(u.isVisible).length === 15), 600);
                expect(sizzle('.roster-group', roster).filter(u.isVisible).length).toBe(5);

                var filter = _converse.rosterview.el.querySelector('.roster-filter');
                filter.value = "colleagues";
                u.triggerEvent(filter, "keydown", "KeyboardEvent");

                await test_utils.waitUntil(() => (sizzle('div.roster-group:not(.collapsed)', roster).length === 1), 600);
                expect(sizzle('div.roster-group:not(.collapsed)', roster).pop().firstElementChild.textContent.trim()).toBe('colleagues');
                expect(sizzle('div.roster-group:not(.collapsed) li', roster).filter(u.isVisible).length).toBe(3);
                // Check that all contacts under the group are shown
                expect(sizzle('div.roster-group:not(.collapsed) li', roster).filter(l => !u.isVisible(l)).length).toBe(0);

                filter = _converse.rosterview.el.querySelector('.roster-filter');
                filter.value = "xxx";
                u.triggerEvent(filter, "keydown", "KeyboardEvent");

                await test_utils.waitUntil(() => (roster.querySelectorAll('div.roster-group.collapsed').length === 5), 700);
                expect(roster.querySelectorAll('div.roster-group:not(.collapsed) a').length).toBe(0);

                filter = _converse.rosterview.el.querySelector('.roster-filter');
                filter.value = ""; // Check that groups are shown again, when the filter string is cleared.
                u.triggerEvent(filter, "keydown", "KeyboardEvent");
                await test_utils.waitUntil(() => (roster.querySelectorAll('div.roster-group.collapsed').length === 0), 700);
                expect(sizzle('div.roster-group:not(collapsed)', roster).length).toBe(5);
                expect(sizzle('div.roster-group:not(collapsed) li', roster).length).toBe(15);
                done();
            }));

            it("has a button with which its contents can be cleared",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _converse.roster_groups = true;
                test_utils.openControlBox();
                test_utils.createGroupedContacts(_converse);

                var filter = _converse.rosterview.el.querySelector('.roster-filter');
                filter.value = "xxx";
                u.triggerEvent(filter, "keydown", "KeyboardEvent");
                expect(_.includes(filter.classList, "x")).toBeFalsy();
                expect(u.hasClass('hidden', _converse.rosterview.el.querySelector('.roster-filter-form .clear-input'))).toBeTruthy();

                test_utils.waitUntil(function () {
                    return !u.hasClass('hidden', _converse.rosterview.el.querySelector('.roster-filter-form .clear-input'));
                }, 900).then(function () {
                    var filter = _converse.rosterview.el.querySelector('.roster-filter');
                    _converse.rosterview.el.querySelector('.clear-input').click();
                    expect(document.querySelector('.roster-filter').value).toBe("");
                    done();
                });
            }));

            it("can be used to filter contacts by their chat state",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createGroupedContacts(_converse);
                var jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@localhost';
                _converse.roster.get(jid).presence.set('show', 'online');
                jid = mock.cur_names[4].replace(/ /g,'.').toLowerCase() + '@localhost';
                _converse.roster.get(jid).presence.set('show', 'dnd');
                test_utils.openControlBox();

                var button = _converse.rosterview.el.querySelector('span[data-type="state"]');
                button.click();

                var roster = _converse.rosterview.roster_el;
                test_utils.waitUntil(() => sizzle('li', roster).filter(u.isVisible).length === 15, 500).then(function () {
                    var filter = _converse.rosterview.el.querySelector('.state-type');
                    expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(5);
                    filter.value = "online";
                    u.triggerEvent(filter, 'change');
                    return test_utils.waitUntil(() => sizzle('li', roster).filter(u.isVisible).length === 1, 500);
                }).then(function () {
                    expect(sizzle('li', roster).filter(u.isVisible).pop().textContent.trim()).toBe('Rinse Sommer');
                    expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(1);

                    var filter = _converse.rosterview.el.querySelector('.state-type');
                    filter.value = "dnd";
                    u.triggerEvent(filter, 'change');
                    return test_utils.waitUntil(function () {
                        return sizzle('li', roster).filter(u.isVisible).pop().textContent.trim() === 'Annegreet Gomez';
                    }, 900)
                }).then(function () {
                    expect(sizzle('ul.roster-group-contacts', roster).filter(u.isVisible).length).toBe(1);
                    done();
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            }));
        });

        describe("A Roster Group", function () {

            it("can be used to organize existing contacts",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                _converse.roster_groups = true;
                spyOn(_converse.rosterview, 'update').and.callThrough();
                _converse.rosterview.render();
                test_utils.openControlBox();
                test_utils.createContacts(_converse, 'pending');
                test_utils.createContacts(_converse, 'requesting');
                test_utils.createGroupedContacts(_converse);
                // Check that the groups appear alphabetically and that
                // requesting and pending contacts are last.
                await test_utils.waitUntil(() => sizzle('.roster-group a.group-toggle', _converse.rosterview.el).length);
                const group_titles = _.map(
                    sizzle('.roster-group a.group-toggle', _converse.rosterview.el),
                    o => o.textContent.trim()
                );
                expect(group_titles).toEqual([
                    "Contact requests",
                    "colleagues",
                    "Family",
                    "friends & acquaintences",
                    "ænemies",
                    "Ungrouped",
                    "Pending contacts"
                ]);
                // Check that usernames appear alphabetically per group
                let names;
                _.each(_.keys(mock.groups), function (name) {
                    const contacts = sizzle('.roster-group[data-group="'+name+'"] ul', _converse.rosterview.el);
                    const names = _.map(contacts, o => o.textContent.trim());
                    expect(names).toEqual(_.clone(names).sort());
                });
                done();
            }));

            it("gets created when a contact's \"groups\" attribute changes",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                _converse.roster_groups = true;
                spyOn(_converse.rosterview, 'update').and.callThrough();
                _converse.rosterview.render();

                test_utils.openControlBox();

                _converse.roster.create({
                    jid: 'groupchanger@localhost',
                    subscription: 'both',
                    ask: null,
                    groups: ['firstgroup'],
                    fullname: 'George Groupchanger'
                });

                // Check that the groups appear alphabetically and that
                // requesting and pending contacts are last.
                let group_titles = await test_utils.waitUntil(() => {
                    const toggles = sizzle('.roster-group a.group-toggle', _converse.rosterview.el);
                    if (_.reduce(toggles, (result, t) => result && u.isVisible(t), true)) {
                        return _.map(toggles, o => o.textContent.trim());
                    } else {
                        return false;
                    }
                }, 1000);
                expect(group_titles).toEqual(['firstgroup']);

                const contact = _converse.roster.get('groupchanger@localhost');
                contact.set({'groups': ['secondgroup']});
                group_titles = await test_utils.waitUntil(() => {
                    const toggles = sizzle('.roster-group[data-group="secondgroup"] a.group-toggle', _converse.rosterview.el);
                    if (_.reduce(toggles, (result, t) => result && u.isVisible(t), true)) {
                        return _.map(toggles, o => o.textContent.trim());
                    } else {
                        return false;
                    }
                }, 1000);
                expect(group_titles).toEqual(['secondgroup']);
                done();
            }));

            it("can share contacts with other roster groups", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {'roster_groups': true},
                    async function (done, _converse) {

                const groups = ['colleagues', 'friends'];
                spyOn(_converse.rosterview, 'update').and.callThrough();
                test_utils.openControlBox();
                _converse.rosterview.render();
                for (var i=0; i<mock.cur_names.length; i++) {
                    _converse.roster.create({
                        jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'both',
                        ask: null,
                        groups: groups,
                        fullname: mock.cur_names[i]
                    });
                }
                await test_utils.waitUntil(() => (sizzle('li', _converse.rosterview.el).filter(u.isVisible).length === 30), 600);
                // Check that usernames appear alphabetically per group
                _.each(groups, function (name) {
                    const contacts = sizzle('.roster-group[data-group="'+name+'"] ul li', _converse.rosterview.el);
                    const names = contacts.map(o => o.textContent.trim());
                    expect(names).toEqual(_.clone(names).sort());
                    expect(names.length).toEqual(mock.cur_names.length);
                });
                done();
            }));

            it("remembers whether it is closed or opened",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                _converse.roster_groups = true;
                test_utils.openControlBox();

                var i=0, j=0;
                var groups = {
                    'colleagues': 3,
                    'friends & acquaintences': 3,
                    'Ungrouped': 2
                };
                _.each(_.keys(groups), function (name) {
                    j = i;
                    for (i=j; i<j+groups[name]; i++) {
                        _converse.roster.create({
                            jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                            subscription: 'both',
                            ask: null,
                            groups: name === 'ungrouped'? [] : [name],
                            fullname: mock.cur_names[i]
                        });
                    }
                });
                const view = _converse.rosterview.get('colleagues');
                const toggle = view.el.querySelector('a.group-toggle');
                expect(view.model.get('state')).toBe('opened');
                toggle.click();
                await test_utils.waitUntil(() => view.model.get('state') === 'closed');
                toggle.click();
                await test_utils.waitUntil(() => view.model.get('state') === 'opened');
                done();
            }));
        });

        describe("Pending Contacts", function () {

            function _addContacts (_converse) {
                // Must be initialized, so that render is called and documentFragment set up.
                test_utils.createContacts(_converse, 'pending');
                test_utils.openControlBox();
            }

            it("can be collapsed under their own header", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                _addContacts(_converse);
                await test_utils.waitUntil(() => sizzle('.roster-group', _converse.rosterview.el).filter(u.isVisible).map(e => e.querySelector('li')).length, 1000);
                await checkHeaderToggling.apply(
                    _converse,
                    [_converse.rosterview.get('Pending contacts').el]
                );
                done();
            }));

            it("can be added to the roster",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                spyOn(_converse.rosterview, 'update').and.callThrough();
                test_utils.openControlBox();
                _converse.roster.create({
                    jid: mock.pend_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'none',
                    ask: 'subscribe',
                    fullname: mock.pend_names[0]
                });
                expect(_converse.rosterview.update).toHaveBeenCalled();
                done();
            }));

            it("are shown in the roster when show_only_online_users", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                _converse.show_only_online_users = true;
                test_utils.openControlBox();
                spyOn(_converse.rosterview, 'update').and.callThrough();
                _addContacts(_converse);
                await test_utils.waitUntil(() => _.reduce(_converse.rosterview.el.querySelectorAll('li'), (result, el) => result && u.isVisible(el), true), 500);
                expect(u.isVisible(_converse.rosterview.el)).toEqual(true);
                expect(_converse.rosterview.update).toHaveBeenCalled();
                expect(_converse.rosterview.el.querySelectorAll('li').length).toBe(3);
                expect(_.filter(_converse.rosterview.el.querySelectorAll('ul.roster-group-contacts'), u.isVisible).length).toBe(1);
                done();
            }));

            it("are shown in the roster when hide_offline_users", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {'hide_offline_users': true},
                    async function (done, _converse) {

                spyOn(_converse.rosterview, 'update').and.callThrough();
                _addContacts(_converse);
                await test_utils.waitUntil(() => sizzle('li', _converse.rosterview.el).filter(u.isVisible).length, 500)
                expect(_converse.rosterview.update).toHaveBeenCalled();
                expect(u.isVisible(_converse.rosterview.el)).toBe(true);
                expect(sizzle('li', _converse.rosterview.el).filter(u.isVisible).length).toBe(3);
                expect(sizzle('ul.roster-group-contacts', _converse.rosterview.el).filter(u.isVisible).length).toBe(1);
                done();
            }));

            it("can be removed by the user", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                _addContacts(_converse);
                const name = mock.pend_names[0];
                const jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                const contact = _converse.roster.get(jid);
                var sent_IQ;
                spyOn(window, 'confirm').and.returnValue(true);
                spyOn(contact, 'unauthorize').and.callFake(function () { return contact; });
                spyOn(contact, 'removeFromRoster').and.callThrough();
                await test_utils.waitUntil(() => sizzle(".pending-contact-name:contains('"+name+"')", _converse.rosterview.el).length, 700);
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    callback();
                });
                sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, _converse.rosterview.el).pop().click();
                await test_utils.waitUntil(() => (sizzle(".pending-contact-name:contains('"+name+"')", _converse.rosterview.el).length === 0), 1000);
                expect(window.confirm).toHaveBeenCalled();
                expect(contact.removeFromRoster).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq type="set" xmlns="jabber:client">`+
                        `<query xmlns="jabber:iq:roster">`+
                            `<item jid="suleyman.van.beusichem@localhost" subscription="remove"/>`+
                        `</query>`+
                    `</iq>`);
                done();
            }));

            it("do not have a header if there aren't any", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.openControlBox();
                const name = mock.pend_names[0];
                _converse.roster.create({
                    jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'none',
                    ask: 'subscribe',
                    fullname: name
                });
                spyOn(window, 'confirm').and.returnValue(true);
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback) {
                    if (typeof callback === "function") { return callback(); }
                });
                await test_utils.waitUntil(() => {
                    const el = _converse.rosterview.get('Pending contacts').el;
                    return u.isVisible(el) && _.filter(el.querySelectorAll('li'), li => u.isVisible(li)).length;
                }, 700)
                            
                sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, _converse.rosterview.el).pop().click();
                expect(window.confirm).toHaveBeenCalled();
                expect(_converse.connection.sendIQ).toHaveBeenCalled();

                await test_utils.waitUntil(() => !u.isVisible(_converse.rosterview.get('Pending contacts').el));
                done();
            }));

            it("is shown when a new private message is received",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                _addContacts(_converse);
                await test_utils.waitUntil(() => _converse.roster.at(0).vcard.get('fullname'))
                spyOn(window, 'confirm').and.returnValue(true);
                for (var i=0; i<mock.pend_names.length; i++) {
                    const name = mock.pend_names[i];
                    sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, _converse.rosterview.el).pop().click();
                }
                expect(u.isVisible(_converse.rosterview.get('Pending contacts').el)).toBe(false);
                done();
            }));

            it("can be added to the roster and they will be sorted alphabetically",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var i, t;
                test_utils.openControlBox();
                spyOn(_converse.rosterview, 'update').and.callThrough();
                for (i=0; i<mock.pend_names.length; i++) {
                    _converse.roster.create({
                        jid: mock.pend_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: 'subscribe',
                        fullname: mock.pend_names[i]
                    });
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                }
                return test_utils.waitUntil(function () {
                    return sizzle('li', _converse.rosterview.get('Pending contacts').el).filter(u.isVisible).length;
                }, 700).then(function () {
                    // Check that they are sorted alphabetically
                    t = _.reduce(_converse.rosterview.get('Pending contacts').el.querySelectorAll('.pending-xmpp-contact span'),
                        function (result, value) {
                            return result + _.trim(value.textContent);
                        }, '');
                    expect(t).toEqual(mock.pend_names.slice(0,i+1).sort().join(''));
                    done();
                });
            }));
        });

        describe("Existing Contacts", function () {
            function _addContacts (_converse) {
                test_utils.createContacts(_converse, 'current').openControlBox()
            }

            it("can be collapsed under their own header", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return sizzle('li', _converse.rosterview.el).filter(u.isVisible).length;
                }, 500).then(function () {
                    checkHeaderToggling.apply(
                        _converse,
                        [_converse.rosterview.el.querySelector('.roster-group')]
                    ).then(done);
                });
            }));

            it("will be hidden when appearing under a collapsed group", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _converse.roster_groups = false;
                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return sizzle('li', _converse.rosterview.el).filter(u.isVisible).length;
                    }, 500)
                .then(function () {
                    _converse.rosterview.el.querySelector('.roster-group a.group-toggle').click();
                    var name = "Max Mustermann";
                    var jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    _converse.roster.create({
                        ask: null,
                        fullname: name,
                        jid: jid,
                        requesting: false,
                        subscription: 'both'
                    });
                    var view = _converse.rosterview.get('My contacts').get(jid);
                    expect(u.isVisible(view.el)).toBe(false);
                    done();
                });
            }));

            it("can be added to the roster and they will be sorted alphabetically", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();
                spyOn(_converse.rosterview, 'update').and.callThrough();
                for (var i=0; i<mock.cur_names.length; i++) {
                    _converse.roster.create({
                        jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'both',
                        ask: null,
                        fullname: mock.cur_names[i]
                    });
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                }
                test_utils.waitUntil(function () {
                    return sizzle('li', _converse.rosterview.el).length;
                }, 600).then(function () {
                    // Check that they are sorted alphabetically
                    const t = _.reduce(
                        _converse.rosterview.el.querySelectorAll('.roster-group .current-xmpp-contact.offline a.open-chat'),
                        (result, value) => (result + value.textContent.trim()), '');

                    expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    done();
                });
            }));

            it("can be removed by the user", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                _addContacts(_converse);
                await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('li').length);
                const name = mock.cur_names[0];
                const jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                const contact = _converse.roster.get(jid);
                spyOn(window, 'confirm').and.returnValue(true);
                spyOn(contact, 'removeFromRoster').and.callThrough();

                const sendIQ = _converse.connection.sendIQ;
                let sent_IQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_IQ = iq;
                    callback();
                });
                sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, _converse.rosterview.el).pop().click();
                expect(window.confirm).toHaveBeenCalled();
                expect(sent_IQ.toLocaleString()).toBe(
                    `<iq type="set" xmlns="jabber:client">`+
                        `<query xmlns="jabber:iq:roster"><item jid="max.frankfurter@localhost" subscription="remove"/></query>`+
                    `</iq>`);
                expect(contact.removeFromRoster).toHaveBeenCalled();
                await test_utils.waitUntil(() => sizzle(".open-chat:contains('"+name+"')", _converse.rosterview.el).length === 0);
                done();
            }));

            it("do not have a header if there aren't any", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.openControlBox();
                var name = mock.cur_names[0];
                var contact;
                contact = _converse.roster.create({
                    jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'both',
                    ask: null,
                    fullname: name
                });
                await test_utils.waitUntil(() => sizzle('.roster-group', _converse.rosterview.el).filter(u.isVisible).map(e => e.querySelector('li')).length, 1000);
                spyOn(window, 'confirm').and.returnValue(true);
                spyOn(contact, 'removeFromRoster').and.callThrough();
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback) {
                    if (typeof callback === "function") { return callback(); }
                });
                expect(u.isVisible(_converse.rosterview.el.querySelector('.roster-group'))).toBe(true);
                sizzle(`.remove-xmpp-contact[title="Click to remove ${name} as a contact"]`, _converse.rosterview.el).pop().click();
                expect(window.confirm).toHaveBeenCalled();
                expect(_converse.connection.sendIQ).toHaveBeenCalled();
                expect(contact.removeFromRoster).toHaveBeenCalled();
                await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length === 0);
                done();
            }));

            it("can change their status to online and be sorted alphabetically", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group li').length, 700)
                .then(function () {
                    var jid, t;
                    spyOn(_converse.rosterview, 'update').and.callThrough();
                    const roster = _converse.rosterview.el;
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).presence.set('show', 'online');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _.reduce(roster.querySelectorAll('.roster-group .current-xmpp-contact.online a.open-chat'), function (result, value) {
                            return result + _.trim(value.textContent);
                        }, '');
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                    done();
                });
            }));

            it("can change their status to busy and be sorted alphabetically", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                    return sizzle('.roster-group li', _converse.rosterview.el).length;
                }, 700).then(function () {
                    var jid, t;
                    spyOn(_converse.rosterview, 'update').and.callThrough();
                    const roster = _converse.rosterview.el;
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).presence.set('show', 'dnd');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _.reduce(roster.querySelectorAll('.roster-group .current-xmpp-contact.dnd a.open-chat'),
                            function (result, value) {
                                return result + _.trim(value.textContent);
                            }, '');
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                    done();
                });
            }));

            it("can change their status to away and be sorted alphabetically", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                    return sizzle('.roster-group li', _converse.rosterview.el).length;
                }, 700).then(function () {
                    var jid, t;
                    spyOn(_converse.rosterview, 'update').and.callThrough();
                    const roster = _converse.rosterview.el;
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).presence.set('show', 'away');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _.reduce(roster.querySelectorAll('.roster-group .current-xmpp-contact.away a.open-chat'),
                            function (result, value) {
                                return result + _.trim(value.textContent);
                            }, '');
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                    done();
                });
            }));

            it("can change their status to xa and be sorted alphabetically", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                _addContacts(_converse);
                await test_utils.waitUntil(() => sizzle('.roster-group li', _converse.rosterview.el).length, 700);
                var jid, t;
                spyOn(_converse.rosterview, 'update').and.callThrough();
                const roster = _converse.rosterview.el;
                for (var i=0; i<mock.cur_names.length; i++) {
                    jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                    _converse.roster.get(jid).presence.set('show', 'xa');
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = _.reduce(roster.querySelectorAll('.roster-group .current-xmpp-contact.xa a.open-chat'),
                        function (result, value) {
                            return result + _.trim(value.textContent);
                        }, '');
                    expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                }
                done();
            }));

            it("can change their status to unavailable and be sorted alphabetically", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                _addContacts(_converse);
                await test_utils.waitUntil(() => sizzle('.roster-group li', _converse.rosterview.el).length, 500)
                var jid, t;
                spyOn(_converse.rosterview, 'update').and.callThrough();
                var roster = _converse.rosterview.el;
                for (var i=0; i<mock.cur_names.length; i++) {
                    jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                    _converse.roster.get(jid).presence.set('show', 'unavailable');
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = _.reduce(roster.querySelectorAll('.roster-group .current-xmpp-contact.unavailable a.open-chat'),
                        function (result, value) {
                            return result + _.trim(value.textContent);
                        }, '');
                    expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                }
                done();
            }));

            it("are ordered according to status: online, busy, away, xa, unavailable, offline", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                    return sizzle('.roster-group li', _converse.rosterview.el).length;
                }, 700).then(function () {
                    var i, jid;
                    for (i=0; i<3; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).presence.set('show', 'online');
                    }
                    for (i=3; i<6; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).presence.set('show', 'dnd');
                    }
                    for (i=6; i<9; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).presence.set('show', 'away');
                    }
                    for (i=9; i<12; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).presence.set('show', 'xa');
                    }
                    for (i=12; i<15; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).presence.set('show', 'unavailable');
                    }
                    return test_utils.waitUntil(function () {
                        return _converse.rosterview.el.querySelectorAll('li.online').length
                    })
                }).then(function () {
                    return test_utils.waitUntil(function () {
                        return _converse.rosterview.el.querySelector('li:first-child').textContent.trim() === 'Candice van der Knijff'
                    }, 900);
                }).then(function () {
                    var i;
                    const contacts = _converse.rosterview.el.querySelectorAll('.current-xmpp-contact');
                    for (i=0; i<3; i++) {
                        expect(u.hasClass('online', contacts[i])).toBe(true);
                        expect(u.hasClass('both', contacts[i])).toBe(true);
                        expect(u.hasClass('dnd', contacts[i])).toBe(false);
                        expect(u.hasClass('away', contacts[i])).toBe(false);
                        expect(u.hasClass('xa', contacts[i])).toBe(false);
                        expect(u.hasClass('unavailable', contacts[i])).toBe(false);
                        expect(u.hasClass('offline', contacts[i])).toBe(false);
                    }
                    for (i=3; i<6; i++) {
                        expect(u.hasClass('dnd', contacts[i])).toBe(true);
                        expect(u.hasClass('both', contacts[i])).toBe(true);
                        expect(u.hasClass('online', contacts[i])).toBe(false);
                        expect(u.hasClass('away', contacts[i])).toBe(false);
                        expect(u.hasClass('xa', contacts[i])).toBe(false);
                        expect(u.hasClass('unavailable', contacts[i])).toBe(false);
                        expect(u.hasClass('offline', contacts[i])).toBe(false);
                    }
                    for (i=6; i<9; i++) {
                        expect(u.hasClass('away', contacts[i])).toBe(true);
                        expect(u.hasClass('both', contacts[i])).toBe(true);
                        expect(u.hasClass('online', contacts[i])).toBe(false);
                        expect(u.hasClass('dnd', contacts[i])).toBe(false);
                        expect(u.hasClass('xa', contacts[i])).toBe(false);
                        expect(u.hasClass('unavailable', contacts[i])).toBe(false);
                        expect(u.hasClass('offline', contacts[i])).toBe(false);
                    }
                    for (i=9; i<12; i++) {
                        expect(u.hasClass('xa', contacts[i])).toBe(true);
                        expect(u.hasClass('both', contacts[i])).toBe(true);
                        expect(u.hasClass('online', contacts[i])).toBe(false);
                        expect(u.hasClass('dnd', contacts[i])).toBe(false);
                        expect(u.hasClass('away', contacts[i])).toBe(false);
                        expect(u.hasClass('unavailable', contacts[i])).toBe(false);
                        expect(u.hasClass('offline', contacts[i])).toBe(false);
                    }
                    for (i=12; i<15; i++) {
                        expect(u.hasClass('unavailable', contacts[i])).toBe(true);
                        expect(u.hasClass('both', contacts[i])).toBe(true);
                        expect(u.hasClass('online', contacts[i])).toBe(false);
                        expect(u.hasClass('dnd', contacts[i])).toBe(false);
                        expect(u.hasClass('away', contacts[i])).toBe(false);
                        expect(u.hasClass('xa', contacts[i])).toBe(false);
                        expect(u.hasClass('offline', contacts[i])).toBe(false);
                    }
                    for (i=15; i<mock.cur_names.length; i++) {
                        expect(u.hasClass('offline', contacts[i])).toBe(true);
                        expect(u.hasClass('both', contacts[i])).toBe(true);
                        expect(u.hasClass('online', contacts[i])).toBe(false);
                        expect(u.hasClass('dnd', contacts[i])).toBe(false);
                        expect(u.hasClass('away', contacts[i])).toBe(false);
                        expect(u.hasClass('xa', contacts[i])).toBe(false);
                        expect(u.hasClass('unavailable', contacts[i])).toBe(false);
                    }
                    done();
                });
            }));
        });

        describe("Requesting Contacts", function () {

            it("can be added to the roster and they will be sorted alphabetically",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var i, children;
                var names = [];
                var addName = function (item) {
                    if (!u.hasClass('request-actions', item)) {
                        names.push(item.textContent.replace(/^\s+|\s+$/g, ''));
                    }
                };
                spyOn(_converse.rosterview, 'update').and.callThrough();
                spyOn(_converse.controlboxtoggle, 'showControlBox').and.callThrough();
                for (i=0; i<mock.req_names.length; i++) {
                    _converse.roster.create({
                        jid: mock.req_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: null,
                        requesting: true,
                        fullname: mock.req_names[i]
                    });
                }
                test_utils.waitUntil(function () {
                    return _converse.rosterview.get('Contact requests').el.querySelectorAll('li').length;
                }, 700).then(function () {
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    children = _converse.rosterview.get('Contact requests').el.querySelectorAll('.requesting-xmpp-contact span');
                    names = [];
                    _.each(children, addName);
                    expect(names.join('')).toEqual(mock.req_names.slice(0,mock.req_names.length+1).sort().join(''));
                    done();
                });
            }));

            it("do not have a header if there aren't any", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.openControlBox();
                const name = mock.req_names[0];
                spyOn(window, 'confirm').and.returnValue(true);
                _converse.roster.create({
                    jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    fullname: name
                });
                await test_utils.waitUntil(() => sizzle('.roster-group', _converse.rosterview.el).filter(u.isVisible).length, 900);
                expect(u.isVisible(_converse.rosterview.get('Contact requests').el)).toEqual(true);
                expect(sizzle('.roster-group', _converse.rosterview.el).filter(u.isVisible).map(e => e.querySelector('li')).length).toBe(1);
                sizzle('.roster-group', _converse.rosterview.el).filter(u.isVisible).map(e => e.querySelector('li .decline-xmpp-request'))[0].click();
                expect(window.confirm).toHaveBeenCalled();
                expect(u.isVisible(_converse.rosterview.get('Contact requests').el)).toEqual(false);
                done();
            }));

            it("can be collapsed under their own header", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.createContacts(_converse, 'requesting').openControlBox();
                await test_utils.waitUntil(() => sizzle('.roster-group', _converse.rosterview.el).filter(u.isVisible).length, 700);
                await checkHeaderToggling.apply(
                    _converse,
                    [_converse.rosterview.get('Contact requests').el]
                );
                done();
            }));

            it("can have their requests accepted by the user", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.openControlBox();
                test_utils.createContacts(_converse, 'requesting').openControlBox();
                const name = mock.req_names.sort()[0];
                const jid =  name.replace(/ /g,'.').toLowerCase() + '@localhost';
                const contact = _converse.roster.get(jid);
                spyOn(contact, 'authorize').and.callFake(() => contact);
                await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group li').length)
                // TODO: Testing can be more thorough here, the user is
                // actually not accepted/authorized because of
                // mock_connection.
                spyOn(_converse.roster, 'sendContactAddIQ').and.callFake(() => Promise.resolve());
                const req_contact = sizzle(".req-contact-name:contains('"+name+"')", _converse.rosterview.el).pop();
                req_contact.parentElement.parentElement.querySelector('.accept-xmpp-request').click();
                expect(_converse.roster.sendContactAddIQ).toHaveBeenCalled();
                await test_utils.waitUntil(() => contact.authorize.calls.count());
                expect(contact.authorize).toHaveBeenCalled();
                done();
            }));

            it("can have their requests denied by the user", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.createContacts(_converse, 'requesting').openControlBox();
                await test_utils.waitUntil(() => sizzle('.roster-group li', _converse.rosterview.el).length, 700);
                _converse.rosterview.update(); // XXX: Hack to make sure $roster element is attaced.
                const name = mock.req_names.sort()[1];
                const jid =  name.replace(/ /g,'.').toLowerCase() + '@localhost';
                const contact = _converse.roster.get(jid);
                spyOn(window, 'confirm').and.returnValue(true);
                spyOn(contact, 'unauthorize').and.callFake(function () { return contact; });
                const req_contact = sizzle(".req-contact-name:contains('"+name+"')", _converse.rosterview.el).pop();
                req_contact.parentElement.parentElement.querySelector('.decline-xmpp-request').click();
                expect(window.confirm).toHaveBeenCalled();
                expect(contact.unauthorize).toHaveBeenCalled();
                // There should now be one less contact
                expect(_converse.roster.length).toEqual(mock.req_names.length-1);
                done();
            }));

            it("are persisted even if other contacts' change their presence ", mock.initConverse(
                null, ['rosterGroupsFetched'], {}, async function (done, _converse) {

                /* This is a regression test.
                 * https://github.com/jcbrand/_converse.js/issues/262
                 */
                expect(_converse.roster.pluck('jid').length).toBe(0);

                let stanza = $pres({from: 'data@enterprise/resource', type: 'subscribe'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await test_utils.waitUntil(() => sizzle('a:contains("Contact requests")', _converse.rosterview.el).length, 700);
                expect(_converse.roster.pluck('jid').length).toBe(1);
                expect(_.includes(_converse.roster.pluck('jid'), 'data@enterprise')).toBeTruthy();
                // Taken from the spec
                // https://xmpp.org/rfcs/rfc3921.html#rfc.section.7.3
                stanza = $iq({
                    to: _converse.connection.jid,
                    type: 'result',
                    id: 'roster_1'
                }).c('query', {
                    xmlns: 'jabber:iq:roster',
                }).c('item', {
                    jid: 'romeo@example.net',
                    name: 'Romeo',
                    subscription:'both'
                }).c('group').t('Friends').up().up()
                .c('item', {
                    jid: 'mercutio@example.org',
                    name: 'Mercutio',
                    subscription:'from'
                }).c('group').t('Friends').up().up()
                .c('item', {
                    jid: 'benvolio@example.org',
                    name: 'Benvolio',
                    subscription:'both'
                }).c('group').t('Friends');
                _converse.roster.onReceivedFromServer(stanza.tree());
                expect(_.includes(_converse.roster.pluck('jid'), 'data@enterprise')).toBeTruthy();
                done();
            }));
        });

        describe("All Contacts", function () {

            it("are saved to, and can be retrieved from browserStorage",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'all').openControlBox();
                var new_attrs, old_attrs, attrs;
                var num_contacts = _converse.roster.length;
                var new_roster = new _converse.RosterContacts();
                // Roster items are yet to be fetched from browserStorage
                expect(new_roster.length).toEqual(0);
                new_roster.browserStorage = _converse.roster.browserStorage;
                new_roster.fetch();
                expect(new_roster.length).toEqual(num_contacts);
                // Check that the roster items retrieved from browserStorage
                // have the same attributes values as the original ones.
                attrs = ['jid', 'fullname', 'subscription', 'ask'];
                for (var i=0; i<attrs.length; i++) {
                    new_attrs = _.map(_.map(new_roster.models, 'attributes'), attrs[i]);
                    old_attrs = _.map(_.map(_converse.roster.models, 'attributes'), attrs[i]);
                    // Roster items in storage are not necessarily sorted,
                    // so we have to sort them here to do a proper
                    // comparison
                    expect(_.isEqual(new_attrs.sort(), old_attrs.sort())).toEqual(true);
                }
                done();
            }));

            it("will show fullname and jid properties on tooltip", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.createContacts(_converse, 'all').openControlBox();
                await test_utils.waitUntil(() => sizzle('.roster-group li', _converse.rosterview.el).length, 700);
                for (let i=0; i<mock.cur_names.length; i++) {
                    const name = mock.cur_names[i];
                    const jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    const child = sizzle("li:contains('"+name+"')", _converse.rosterview.el).pop().firstElementChild;
                    expect(child.textContent.trim()).toBe(name);
                    expect(child.getAttribute('title')).toContain(name);
                    expect(child.getAttribute('title')).toContain(jid);
                }
                done();
            }));
        });
    });
}));
