(function (root, factory) {
    define(["mock", "converse-core", "test_utils"], factory);
} (this, function (mock, converse, test_utils) {
    var _ = converse.env._;
    var $ = converse.env.jQuery;
    var $pres = converse.env.$pres;
    var $iq = converse.env.$iq;

    var checkHeaderToggling = function ($header) {
        var $toggle = $header.find('a.group-toggle');
        expect($header.css('display')).toEqual('block');
        expect($header.nextUntil('dt', 'dd').length === $header.nextUntil('dt', 'dd:visible').length).toBeTruthy();
        expect($toggle.hasClass('icon-closed')).toBeFalsy();
        expect($toggle.hasClass('icon-opened')).toBeTruthy();
        $toggle.click();
        expect($toggle.hasClass('icon-closed')).toBeTruthy();
        expect($toggle.hasClass('icon-opened')).toBeFalsy();
        expect($header.nextUntil('dt', 'dd').length === $header.nextUntil('dt', 'dd:hidden').length).toBeTruthy();
        $toggle.click();
        expect($toggle.hasClass('icon-closed')).toBeFalsy();
        expect($toggle.hasClass('icon-opened')).toBeTruthy();
        expect($header.nextUntil('dt', 'dd').length === $header.nextUntil('dt', 'dd:visible').length).toBeTruthy();
    };

    describe("The Control Box", function () {

        it("can be opened by clicking a DOM element with class 'toggle-controlbox'", mock.initConverse(function (_converse) {
            runs(function () {
                // This spec will only pass if the controlbox is not currently
                // open yet.
                expect($("div#controlbox").is(':visible')).toBe(false);
                spyOn(_converse.controlboxtoggle, 'onClick').andCallThrough();
                spyOn(_converse.controlboxtoggle, 'showControlBox').andCallThrough();
                spyOn(_converse, 'emit');
                // Redelegate so that the spies are now registered as the event handlers (specifically for 'onClick')
                _converse.controlboxtoggle.delegateEvents();
                $('.toggle-controlbox').click();
            }.bind(_converse));
            waits(50);
            runs(function () {
                expect(_converse.controlboxtoggle.onClick).toHaveBeenCalled();
                expect(_converse.controlboxtoggle.showControlBox).toHaveBeenCalled();
                expect(_converse.emit).toHaveBeenCalledWith('controlBoxOpened', jasmine.any(Object));
                expect($("div#controlbox").is(':visible')).toBe(true);
            }.bind(_converse));
        }));

        describe("The Status Widget", function () {

            it("shows the user's chat status, which is online by default", mock.initConverse(function (_converse) {
                test_utils.openControlBox();
                var view = _converse.xmppstatusview;
                expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(true);
                expect(view.$el.find('a.choose-xmpp-status').attr('data-value')).toBe('I am online');
            }));

            it("can be used to set the current user's chat status", mock.initConverse(function (_converse) {
                test_utils.openControlBox();
                var view = _converse.xmppstatusview;
                spyOn(view, 'toggleOptions').andCallThrough();
                spyOn(view, 'setStatus').andCallThrough();
                spyOn(_converse, 'emit');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                runs(function () {
                    view.$el.find('a.choose-xmpp-status').click();
                    expect(view.toggleOptions).toHaveBeenCalled();
                });
                waits(250);
                runs(function () {
                    spyOn(view, 'updateStatusUI').andCallThrough();
                    view.initialize(); // Rebind events for spy
                    $(view.$el.find('.dropdown dd ul li a')[1]).click(); // Change status to "dnd"
                    expect(view.setStatus).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('statusChanged', 'dnd');
                });
                waits(250);
                runs(function () {
                    expect(view.updateStatusUI).toHaveBeenCalled();
                    expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(false);
                    expect(view.$el.find('a.choose-xmpp-status').hasClass('dnd')).toBe(true);
                    expect(view.$el.find('a.choose-xmpp-status').attr('data-value')).toBe('I am busy');
                });
            }));

            it("can be used to set a custom status message", mock.initConverse(function (_converse) {
                test_utils.openControlBox();
                var view = _converse.xmppstatusview;
                _converse.xmppstatus.save({'status': 'online'});
                spyOn(view, 'setStatusMessage').andCallThrough();
                spyOn(view, 'renderStatusChangeForm').andCallThrough();
                spyOn(_converse, 'emit');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                view.$el.find('a.change-xmpp-status-message').click();
                expect(view.renderStatusChangeForm).toHaveBeenCalled();
                // The async testing here is used only to provide time for
                // visual feedback
                var msg = 'I am happy';
                runs (function () {
                    view.$el.find('form input.custom-xmpp-status').val(msg);
                });
                waits(250);
                runs (function () {
                    view.$el.find('form#set-custom-xmpp-status').submit();
                    expect(view.setStatusMessage).toHaveBeenCalled();
                    expect(_converse.emit).toHaveBeenCalledWith('statusMessageChanged', msg);
                    expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(true);
                    expect(view.$el.find('a.choose-xmpp-status').attr('data-value')).toBe(msg);
                });
            }));
        });
    });

    describe("The Contacts Roster", function () {

        describe("The live filter", function () {

            it("will only appear when roster contacts flow over the visible area", mock.initConverse(function (_converse) {
                var $filter = _converse.rosterview.$('.roster-filter');
                var names = mock.cur_names;
                runs(function () {
                    test_utils.openControlBox();
                    _converse.rosterview.update(); // XXX: Will normally called as event handler
                });
                waits(5); // Needed, due to debounce
                runs(function () {
                    expect($filter.length).toBe(1);
                    expect($filter.is(':visible')).toBeFalsy();
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
                });
                waits(5); // Needed, due to debounce
                runs(function () {
                    $filter = _converse.rosterview.$('.roster-filter');
                    if (_converse.rosterview.$roster.hasScrollBar()) {
                        expect($filter.is(':visible')).toBeTruthy();
                    } else {
                        expect($filter.is(':visible')).toBeFalsy();
                    }
                });
            }));

            it("can be used to filter the contacts shown", mock.initConverse(function (_converse) {
                var $filter;
                var $roster;
                runs(function () {
                    _converse.roster_groups = true;
                    test_utils.openControlBox();
                });
                waits(50);
                runs(function () {
                    test_utils.createGroupedContacts(_converse);
                    $filter = _converse.rosterview.$('.roster-filter');
                    $roster = _converse.rosterview.$roster;
                });
                waits(5); // Needed, due to debounce in "update" method
                runs(function () {
                    _converse.rosterview.filter_view.delegateEvents();
                    expect($roster.find('dd:visible').length).toBe(15);
                    expect($roster.find('dt:visible').length).toBe(5);
                    $filter.val("candice");
                    expect($roster.find('dd:visible').length).toBe(15); // because no keydown event
                    expect($roster.find('dt:visible').length).toBe(5);  // ditto
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dd:visible').length).toBe(1);
                    expect($roster.find('dd:visible').eq(0).text().trim()).toBe('Candice van der Knijff');
                    expect($roster.find('dt:visible').length).toBe(1);
                    expect($roster.find('dt:visible').eq(0).text()).toBe('colleagues');
                    $filter = _converse.rosterview.$('.roster-filter');
                    $filter.val("an");
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dd:visible').length).toBe(5);
                    expect($roster.find('dt:visible').length).toBe(4);
                    $filter = _converse.rosterview.$('.roster-filter');
                    $filter.val("xxx");
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dd:visible').length).toBe(0);
                    expect($roster.find('dt:visible').length).toBe(0);
                    $filter = _converse.rosterview.$('.roster-filter');
                    $filter.val("");  // Check that contacts are shown again, when the filter string is cleared.
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs(function () {
                    expect($roster.find('dd:visible').length).toBe(15);
                    expect($roster.find('dt:visible').length).toBe(5);
                });
                _converse.roster_groups = false;
            }));

            it("can be used to filter the groups shown", mock.initConverse(function (_converse) {
                var $filter;
                var $roster;
                var $type;
                runs(function () {
                    _converse.roster_groups = true;
                    test_utils.openControlBox();
                });
                waits(50); // Needed, due to debounce in "update" method
                runs(function () {
                    test_utils.createGroupedContacts(_converse);
                    _converse.rosterview.filter_view.delegateEvents();
                    $filter = _converse.rosterview.$('.roster-filter');
                    $roster = _converse.rosterview.$roster;
                    $type = _converse.rosterview.$('.filter-type');
                    $type.val('groups');
                });
                waits(550); // Needed, due to debounce
                runs(function () {
                    expect($roster.find('dd:visible').length).toBe(15);
                    expect($roster.find('dt:visible').length).toBe(5);
                    $filter.val("colleagues");
                });
                waits(50); // Needed, due to debounce
                runs(function () {
                    expect($roster.find('dd:visible').length).toBe(15); // because no keydown event
                    expect($roster.find('dt:visible').length).toBe(5);  // ditto
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dt:visible').length).toBe(1);
                    expect($roster.find('dt:visible').eq(0).text()).toBe('colleagues');
                    // Check that all contacts under the group are shown
                    expect($roster.find('dt:visible').nextUntil('dt', 'dd:hidden').length).toBe(0);
                    $filter = _converse.rosterview.$('.roster-filter');
                    $filter.val("xxx");
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dt:visible').length).toBe(0);
                    $filter = _converse.rosterview.$('.roster-filter');
                    $filter.val(""); // Check that groups are shown again, when the filter string is cleared.
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs(function () {
                    expect($roster.find('dd:visible').length).toBe(15);
                    expect($roster.find('dt:visible').length).toBe(5);
                });
                _converse.roster_groups = false;
            }));

            it("has a button with which its contents can be cleared", mock.initConverse(function (_converse) {
                _converse.roster_groups = true;
                test_utils.createGroupedContacts(_converse);
                var $filter = _converse.rosterview.$('.roster-filter');
                runs (function () {
                    _converse.rosterview.filter_view.delegateEvents();
                    $filter.val("xxx");
                    $filter.trigger('keydown');
                    expect($filter.hasClass("x")).toBeFalsy();
                });
                waits(550); // Needed, due to debounce
                runs (function () {
                    $filter = _converse.rosterview.$('.roster-filter');
                    expect($filter.hasClass("x")).toBeTruthy();
                    $filter.addClass("onX").click();
                    expect($filter.val()).toBe("");
                });
                _converse.roster_groups = false;
            }));

            it("can be used to filter contacts by their chat state", mock.initConverse(function (_converse) {
                var $filter;
                var $roster;
                _converse.roster_groups = true;
                test_utils.createGroupedContacts(_converse);
                var jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@localhost';
                _converse.roster.get(jid).set('chat_status', 'online');

                runs(function () {
                    test_utils.openControlBox();
                    _converse.rosterview.filter_view.delegateEvents();
                    var $type = _converse.rosterview.$('.filter-type');
                    $type.val('state').trigger('change');
                });
                waits(300); // Needed, due to debounce in "update" method
                runs(function () {
                    $filter = _converse.rosterview.$('.state-type');
                    $roster = _converse.rosterview.$roster;
                    expect($roster.find('dd:visible').length).toBe(15);
                    expect($roster.find('dt:visible').length).toBe(5);
                    $filter.val("online");
                    expect($roster.find('dd:visible').length).toBe(15); // because no change event yet
                    expect($roster.find('dt:visible').length).toBe(5);  // ditto
                    $filter.trigger('change');
                });
                waits(550); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dd:visible').length).toBe(1);
                    expect($roster.find('dd:visible').eq(0).text().trim()).toBe('Rinse Sommer');
                    expect($roster.find('dt:visible').length).toBe(1);

                    var $type = _converse.rosterview.$('.filter-type');
                    $type.val('contacts').trigger('change');
                    _converse.roster_groups = false;
                });
            }));
        });

        describe("A Roster Group", function () {

            it("can be used to organize existing contacts", mock.initConverse(function (_converse) {
                runs(function () {
                    _converse.roster_groups = true;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').andCallThrough();
                    _converse.rosterview.render();
                    test_utils.createContacts(_converse, 'pending');
                    test_utils.createContacts(_converse, 'requesting');
                    test_utils.createGroupedContacts(_converse);
                });
                waits(50); // Needed, due to debounce
                runs(function () {
                    // Check that the groups appear alphabetically and that
                    // requesting and pending contacts are last.
                    var group_titles = $.map(_converse.rosterview.$el.find('dt'), function (o) { return $(o).text().trim(); });
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
                    _.each(_.keys(mock.groups), function (name) {
                        var $contacts = _converse.rosterview.$('dt.roster-group[data-group="'+name+'"]').nextUntil('dt', 'dd');
                        var names = $.map($contacts, function (o) { return $(o).text().trim(); });
                        expect(names).toEqual(_.clone(names).sort());
                    });
                });
            }));

            it("can share contacts with other roster groups", mock.initConverse(function (_converse) {
                _converse.roster_groups = true;
                var groups = ['colleagues', 'friends'];
                runs(function () {
                    var i=0;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').andCallThrough();
                    _converse.rosterview.render();
                    for (i=0; i<mock.cur_names.length; i++) {
                        _converse.roster.create({
                            jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                            subscription: 'both',
                            ask: null,
                            groups: groups,
                            fullname: mock.cur_names[i]
                        });
                    }
                });
                waits(50); // Needed, due to debounce
                runs(function () {
                    // Check that usernames appear alphabetically per group
                    _.each(groups, function (name) {
                        var $contacts = _converse.rosterview.$('dt.roster-group[data-group="'+name+'"]').nextUntil('dt', 'dd');
                        var names = $.map($contacts, function (o) { return $(o).text().trim(); });
                        expect(names).toEqual(_.clone(names).sort());
                        expect(names.length).toEqual(mock.cur_names.length);
                    });
                });
            }));

            it("remembers whether it is closed or opened", mock.initConverse(function (_converse) {
                _converse.roster_groups = true;
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
                var view = _converse.rosterview.get('colleagues');
                var $toggle = view.$el.find('a.group-toggle');
                expect(view.model.get('state')).toBe('opened');
                $toggle.click();
                expect(view.model.get('state')).toBe('closed');
                $toggle.click();
                expect(view.model.get('state')).toBe('opened');
            }));
        });

        describe("Pending Contacts", function () {

            function _addContacts (_converse) {
                // Must be initialized, so that render is called and documentFragment set up.
                test_utils.createContacts(_converse, 'pending').openControlBox().openContactsPanel(_converse);
            }

            it("can be collapsed under their own header", mock.initConverse(function (_converse) {
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                runs(function () {
                    checkHeaderToggling.apply(_converse, [_converse.rosterview.get('Pending contacts').$el]);
                });
            }));

            it("can be added to the roster", mock.initConverse(function (_converse) {
                spyOn(_converse, 'emit');
                spyOn(_converse.rosterview, 'update').andCallThrough();
                runs(function () {
                    test_utils.openControlBox();
                    _converse.roster.create({
                        jid: mock.pend_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: 'subscribe',
                        fullname: mock.pend_names[0]
                    });
                });
                waits(300);
                runs(function () {
                    expect(_converse.rosterview.$el.is(':visible')).toEqual(true);
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                });
            }));

            it("are shown in the roster when show_only_online_users", mock.initConverse(function (_converse) {
                _converse.show_only_online_users = true;
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                spyOn(_converse.rosterview, 'update').andCallThrough();
                runs(function () {
                    expect(_converse.rosterview.$el.is(':visible')).toEqual(true);
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                });
                waits(300); // Needed, due to debounce
                runs (function () {
                    expect(_converse.rosterview.$el.find('dd:visible').length).toBe(3);
                    expect(_converse.rosterview.$el.find('dt:visible').length).toBe(1);
                });
                _converse.show_only_online_users = false;
            }));

            it("are shown in the roster when hide_offline_users", mock.initConverse(function (_converse) {
                _converse.hide_offline_users = true;
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                spyOn(_converse.rosterview, 'update').andCallThrough();
                runs(function () {
                    expect(_converse.rosterview.$el.is(':visible')).toEqual(true);
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                });
                waits(300); // Needed, due to debounce
                runs (function () {
                    expect(_converse.rosterview.$el.find('dd:visible').length).toBe(3);
                    expect(_converse.rosterview.$el.find('dt:visible').length).toBe(1);
                });
                _converse.hide_offline_users = false;
            }));

            it("can be removed by the user", mock.initConverse(function (_converse) {
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                runs(function () {
                    var name = mock.pend_names[0];
                    var jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var contact = _converse.roster.get(jid);
                    spyOn(window, 'confirm').andReturn(true);
                    spyOn(contact, 'unauthorize').andCallFake(function () { return contact; });
                    spyOn(contact, 'removeFromRoster');
                    spyOn(_converse.connection, 'sendIQ').andCallFake(function (iq, callback) {
                        if (typeof callback === "function") { return callback(); }
                    });

                    _converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')")
                        .parent().siblings('.remove-xmpp-contact').click();

                    expect(window.confirm).toHaveBeenCalled();
                    expect(_converse.connection.sendIQ).toHaveBeenCalled();
                    expect(contact.removeFromRoster).toHaveBeenCalled();
                    expect(_converse.connection.sendIQ).toHaveBeenCalled();
                    expect(_converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')").length).toEqual(0);
                });
            }));

            it("do not have a header if there aren't any", mock.initConverse(function (_converse) {
                runs(function () {
                    test_utils.openControlBox();
                    var name = mock.pend_names[0];
                    _converse.roster.create({
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: 'subscribe',
                        fullname: name
                    });
                });
                waits(20);
                runs(function () {
                    spyOn(window, 'confirm').andReturn(true);
                    spyOn(_converse.connection, 'sendIQ').andCallFake(function (iq, callback) {
                        if (typeof callback === "function") { return callback(); }
                    });
                    expect(_converse.rosterview.get('Pending contacts').$el.is(':visible')).toEqual(true);
                    _converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')")
                        .parent().siblings('.remove-xmpp-contact').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(_converse.connection.sendIQ).toHaveBeenCalled();
                    expect(_converse.rosterview.get('Pending contacts').$el.is(':visible')).toEqual(false);
                });
            }));

            it("will lose their own header once the last one has been removed", mock.initConverse(function (_converse) {
                _addContacts(_converse);
                var name;
                spyOn(window, 'confirm').andReturn(true);
                for (var i=0; i<mock.pend_names.length; i++) {
                    name = mock.pend_names[i];
                    _converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')")
                        .parent().siblings('.remove-xmpp-contact').click();
                }
                expect(_converse.rosterview.$el.find('dt#pending-xmpp-contacts').is(':visible')).toBeFalsy();
            }));

            it("can be added to the roster and they will be sorted alphabetically", mock.initConverse(function (_converse) {
                var i, t;
                spyOn(_converse, 'emit');
                spyOn(_converse.rosterview, 'update').andCallThrough();
                for (i=0; i<mock.pend_names.length; i++) {
                    _converse.roster.create({
                        jid: mock.pend_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: 'subscribe',
                        fullname: mock.pend_names[i]
                    });
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                }
                // Check that they are sorted alphabetically
                t = _converse.rosterview.get('Pending contacts').$el.siblings('dd.pending-xmpp-contact').find('span').text();
                expect(t).toEqual(mock.pend_names.slice(0,i+1).sort().join(''));
            }));

        });

        describe("Existing Contacts", function () {
            var _addContacts = function (_converse) {
                test_utils.createContacts(_converse, 'current').openControlBox().openContactsPanel(_converse);
            };

            it("can be collapsed under their own header", mock.initConverse(function (_converse) {
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                runs(function () {
                    checkHeaderToggling.apply(_converse, [_converse.rosterview.$el.find('dt.roster-group')]);
                });
            }));

            it("will be hidden when appearing under a collapsed group", mock.initConverse(function (_converse) {
                _converse.roster_groups = false;
                _addContacts(_converse);
                _converse.rosterview.$el.find('dt.roster-group').find('a.group-toggle').click();
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
                expect(view.$el.is(':visible')).toBe(false);
            }));

            it("can be added to the roster and they will be sorted alphabetically", mock.initConverse(function (_converse) {
                var i, t;
                spyOn(_converse.rosterview, 'update').andCallThrough();
                runs(function () {
                    for (i=0; i<mock.cur_names.length; i++) {
                        _converse.roster.create({
                            jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                            subscription: 'both',
                            ask: null,
                            fullname: mock.cur_names[i]
                        });
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                    }
                });
                waits(10);
                runs(function () {
                    // Check that they are sorted alphabetically
                    t = _converse.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.offline').find('a.open-chat').text();
                    expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                });
            }));

            it("can be removed by the user", mock.initConverse(function (_converse) {
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                runs(function () {
                    var name = mock.cur_names[0];
                    var jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var contact = _converse.roster.get(jid);
                    spyOn(window, 'confirm').andReturn(true);
                    spyOn(contact, 'removeFromRoster');
                    spyOn(_converse.connection, 'sendIQ').andCallFake(function (iq, callback) {
                        if (typeof callback === "function") { return callback(); }
                    });

                    _converse.rosterview.$el.find(".open-chat:contains('"+name+"')")
                        .parent().find('.remove-xmpp-contact').click();

                    expect(window.confirm).toHaveBeenCalled();
                    expect(_converse.connection.sendIQ).toHaveBeenCalled();
                    expect(contact.removeFromRoster).toHaveBeenCalled();
                    expect(_converse.rosterview.$el.find(".open-chat:contains('"+name+"')").length).toEqual(0);
                });
            }));


            it("do not have a header if there aren't any", mock.initConverse(function (_converse) {
                var name = mock.cur_names[0];
                var contact;
                runs(function () {
                    contact = _converse.roster.create({
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'both',
                        ask: null,
                        fullname: name
                    });
                });
                waits(50);
                runs(function () {
                    spyOn(window, 'confirm').andReturn(true);
                    spyOn(contact, 'removeFromRoster');
                    spyOn(_converse.connection, 'sendIQ').andCallFake(function (iq, callback) {
                        if (typeof callback === "function") { return callback(); }
                    });

                    expect(_converse.rosterview.$el.find('dt.roster-group').css('display')).toEqual('block');
                    _converse.rosterview.$el.find(".open-chat:contains('"+name+"')")
                        .parent().find('.remove-xmpp-contact').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(_converse.connection.sendIQ).toHaveBeenCalled();
                    expect(contact.removeFromRoster).toHaveBeenCalled();
                    expect(_converse.rosterview.$el.find('dt.roster-group').css('display')).toEqual('none');
                });
            }));

            it("can change their status to online and be sorted alphabetically", mock.initConverse(function (_converse) {
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                runs(function () {
                    var jid, t;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').andCallThrough();
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'online');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _converse.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.online').find('a.open-chat').text();
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                });
            }));

            it("can change their status to busy and be sorted alphabetically", mock.initConverse(function (_converse) {
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                runs(function () {
                    var jid, t;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').andCallThrough();
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'dnd');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _converse.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.dnd').find('a.open-chat').text();
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                });
            }));

            it("can change their status to away and be sorted alphabetically", mock.initConverse(function (_converse) {
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                runs(function () {
                    var jid, t;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').andCallThrough();
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'away');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _converse.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.away').find('a.open-chat').text();
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                });
            }));

            it("can change their status to xa and be sorted alphabetically", mock.initConverse(function (_converse) {
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                runs(function () {
                    var jid, t;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').andCallThrough();
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'xa');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _converse.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.xa').find('a.open-chat').text();
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                });
            }));

            it("can change their status to unavailable and be sorted alphabetically", mock.initConverse(function (_converse) {
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                runs(function () {
                    var jid, t;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').andCallThrough();
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'unavailable');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _converse.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.unavailable').find('a.open-chat').text();
                        expect(t).toEqual(mock.cur_names.slice(0, i+1).sort().join(''));
                    }
                });
            }));

            it("are ordered according to status: online, busy, away, xa, unavailable, offline", mock.initConverse(function (_converse) {
                runs(function () {
                    _addContacts(_converse);
                });
                waits(50);
                runs(function () {
                    var i, jid;
                    for (i=0; i<3; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'online');
                    }
                    for (i=3; i<6; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'dnd');
                    }
                    for (i=6; i<9; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'away');
                    }
                    for (i=9; i<12; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'xa');
                    }
                    for (i=12; i<15; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'unavailable');
                    }

                    var contacts = _converse.rosterview.$el.find('dd.current-xmpp-contact');
                    for (i=0; i<3; i++) {
                        expect($(contacts[i]).hasClass('online')).toBeTruthy();
                        expect($(contacts[i]).hasClass('both')).toBeTruthy();
                        expect($(contacts[i]).hasClass('dnd')).toBeFalsy();
                        expect($(contacts[i]).hasClass('away')).toBeFalsy();
                        expect($(contacts[i]).hasClass('xa')).toBeFalsy();
                        expect($(contacts[i]).hasClass('unavailable')).toBeFalsy();
                        expect($(contacts[i]).hasClass('offline')).toBeFalsy();
                    }
                    for (i=3; i<6; i++) {
                        expect($(contacts[i]).hasClass('dnd')).toBeTruthy();
                        expect($(contacts[i]).hasClass('both')).toBeTruthy();
                        expect($(contacts[i]).hasClass('online')).toBeFalsy();
                        expect($(contacts[i]).hasClass('away')).toBeFalsy();
                        expect($(contacts[i]).hasClass('xa')).toBeFalsy();
                        expect($(contacts[i]).hasClass('unavailable')).toBeFalsy();
                        expect($(contacts[i]).hasClass('offline')).toBeFalsy();
                    }
                    for (i=6; i<9; i++) {
                        expect($(contacts[i]).hasClass('away')).toBeTruthy();
                        expect($(contacts[i]).hasClass('both')).toBeTruthy();
                        expect($(contacts[i]).hasClass('online')).toBeFalsy();
                        expect($(contacts[i]).hasClass('dnd')).toBeFalsy();
                        expect($(contacts[i]).hasClass('xa')).toBeFalsy();
                        expect($(contacts[i]).hasClass('unavailable')).toBeFalsy();
                        expect($(contacts[i]).hasClass('offline')).toBeFalsy();
                    }
                    for (i=9; i<12; i++) {
                        expect($(contacts[i]).hasClass('xa')).toBeTruthy();
                        expect($(contacts[i]).hasClass('both')).toBeTruthy();
                        expect($(contacts[i]).hasClass('online')).toBeFalsy();
                        expect($(contacts[i]).hasClass('dnd')).toBeFalsy();
                        expect($(contacts[i]).hasClass('away')).toBeFalsy();
                        expect($(contacts[i]).hasClass('unavailable')).toBeFalsy();
                        expect($(contacts[i]).hasClass('offline')).toBeFalsy();
                    }
                    for (i=12; i<15; i++) {
                        expect($(contacts[i]).hasClass('unavailable')).toBeTruthy();
                        expect($(contacts[i]).hasClass('both')).toBeTruthy();
                        expect($(contacts[i]).hasClass('online')).toBeFalsy();
                        expect($(contacts[i]).hasClass('dnd')).toBeFalsy();
                        expect($(contacts[i]).hasClass('away')).toBeFalsy();
                        expect($(contacts[i]).hasClass('xa')).toBeFalsy();
                        expect($(contacts[i]).hasClass('offline')).toBeFalsy();
                    }
                    for (i=15; i<mock.cur_names.length; i++) {
                        expect($(contacts[i]).hasClass('offline')).toBeTruthy();
                        expect($(contacts[i]).hasClass('both')).toBeTruthy();
                        expect($(contacts[i]).hasClass('online')).toBeFalsy();
                        expect($(contacts[i]).hasClass('dnd')).toBeFalsy();
                        expect($(contacts[i]).hasClass('away')).toBeFalsy();
                        expect($(contacts[i]).hasClass('xa')).toBeFalsy();
                        expect($(contacts[i]).hasClass('unavailable')).toBeFalsy();
                    }
                });
            }));
        });

        describe("Requesting Contacts", function () {

            it("can be added to the roster and they will be sorted alphabetically", mock.initConverse(function (_converse) {
                var i, children;
                var names = [];
                var addName = function (idx, item) {
                    if (!$(item).hasClass('request-actions')) {
                        names.push($(item).text().replace(/^\s+|\s+$/g, ''));
                    }
                };
                runs(function () {
                    test_utils.openContactsPanel(_converse);
                });
                waits(250);
                runs(function () {
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').andCallThrough();
                    spyOn(_converse.controlboxtoggle, 'showControlBox').andCallThrough();
                    for (i=0; i<mock.req_names.length; i++) {
                        _converse.roster.create({
                            jid: mock.req_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                            subscription: 'none',
                            ask: null,
                            requesting: true,
                            fullname: mock.req_names[i]
                        });
                    }
                });
                waits(250);
                runs(function () {
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    children = _converse.rosterview.get('Contact requests').$el.siblings('dd.requesting-xmpp-contact').find('span');
                    names = [];
                    children.each(addName);
                    expect(names.join('')).toEqual(mock.req_names.slice(0,mock.req_names.length+1).sort().join(''));
                });

            }));

            it("do not have a header if there aren't any", mock.initConverse(function (_converse) {
                test_utils.openContactsPanel(_converse);

                var name = mock.req_names[0];
                runs(function () {
                    spyOn(window, 'confirm').andReturn(true);
                    _converse.roster.create({
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: null,
                        requesting: true,
                        fullname: name
                    });
                });
                waits(350);
                runs(function () {
                    expect(_converse.rosterview.get('Contact requests').$el.is(':visible')).toEqual(true);
                    _converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                        .parent().siblings('.request-actions')
                        .find('.decline-xmpp-request').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(_converse.rosterview.get('Contact requests').$el.is(':visible')).toEqual(false);
                });
            }));

            it("can be collapsed under their own header", mock.initConverse(function (_converse) {
                runs(function () {
                    test_utils.createContacts(_converse, 'requesting').openControlBox();
                });
                waits(10);
                runs(function () {
                    checkHeaderToggling.apply(_converse, [_converse.rosterview.get('Contact requests').$el]);
                });
            }));

            it("can have their requests accepted by the user", mock.initConverse(function (_converse) {
                runs(function () {
                    test_utils.createContacts(_converse, 'requesting').openControlBox();
                });
                waits(10);
                runs(function () {
                    // TODO: Testing can be more thorough here, the user is
                    // actually not accepted/authorized because of
                    // mock_connection.
                    var name = mock.req_names.sort()[0];
                    var jid =  name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var contact = _converse.roster.get(jid);
                    spyOn(_converse.roster, 'sendContactAddIQ').andCallFake(function (jid, fullname, groups, callback) {
                        callback();
                    });
                    spyOn(contact, 'authorize').andCallFake(function () { return contact; });
                    _converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                        .parent().siblings('.request-actions')
                        .find('.accept-xmpp-request').click();
                    expect(_converse.roster.sendContactAddIQ).toHaveBeenCalled();
                    expect(contact.authorize).toHaveBeenCalled();
                });
            }));

            it("can have their requests denied by the user", mock.initConverse(function (_converse) {
                runs(function () {
                    test_utils.createContacts(_converse, 'requesting').openControlBox();
                    _converse.rosterview.update(); // XXX: Hack to make sure $roster element is attaced.
                });
                waits(50);
                runs(function () {
                    var name = mock.req_names.sort()[1];
                    var jid =  name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var contact = _converse.roster.get(jid);
                    spyOn(window, 'confirm').andReturn(true);
                    spyOn(contact, 'unauthorize').andCallFake(function () { return contact; });
                    _converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                        .parent().siblings('.request-actions')
                        .find('.decline-xmpp-request').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(contact.unauthorize).toHaveBeenCalled();
                    // There should now be one less contact
                    expect(_converse.roster.length).toEqual(mock.req_names.length-1);
                });
            }));

            it("are persisted even if other contacts' change their presence ", mock.initConverse(function (_converse) {
                /* This is a regression test.
                 * https://github.com/jcbrand/_converse.js/issues/262
                 */
                expect(_converse.roster.pluck('jid').length).toBe(0);

                var stanza = $pres({from: 'data@enterprise/resource', type: 'subscribe'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                expect(_converse.roster.pluck('jid').length).toBe(1);
                expect(_.includes(_converse.roster.pluck('jid'), 'data@enterprise')).toBeTruthy();

                // Taken from the spec
                // http://xmpp.org/rfcs/rfc3921.html#rfc.section.7.3
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
            }));
        });

        describe("All Contacts", function () {

            it("are saved to, and can be retrieved from browserStorage", mock.initConverse(function (_converse) {
                test_utils.createContacts(_converse, 'all').openControlBox();
                test_utils.openContactsPanel(_converse);
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
            }));

            it("will show fullname and jid properties on tooltip", mock.initConverse(function (_converse) {
                runs(function () {
                    test_utils.createContacts(_converse, 'all').openControlBox();
                    test_utils.openContactsPanel(_converse);
                });
                waits(10);
                runs(function () {
                    var jid, name, i;
                    for (i=0; i<mock.cur_names.length; i++) {
                        name = mock.cur_names[i];
                        jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                        var $dd = _converse.rosterview.$el.find("dd:contains('"+name+"')").children().first();
                        var dd_text = $dd.text();
                        var dd_title = $dd.attr('title');
                        expect(dd_text).toBe(name);
                        expect(dd_title).toContain(name);
                        expect(dd_title).toContain(jid);
                    }
                });
            }));

        });
    });

    describe("The 'Add Contact' widget", function () {

        it("opens up an add form when you click on it", mock.initConverse(function (_converse) {
            var panel = _converse.chatboxviews.get('controlbox').contactspanel;
            spyOn(panel, 'toggleContactForm').andCallThrough();
            panel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
            panel.$el.find('a.toggle-xmpp-contact-form').click();
            expect(panel.toggleContactForm).toHaveBeenCalled();
            // XXX: Awaiting more tests, close it again for now...
            panel.$el.find('a.toggle-xmpp-contact-form').click();
        }));

        it("can be used to add contact and it checks for case-sensivity", mock.initConverse(function (_converse) {
            spyOn(_converse, 'emit');
            spyOn(_converse.rosterview, 'update').andCallThrough();
            runs(function () {
                test_utils.openControlBox();
                // Adding two contacts one with Capital initials and one with small initials of same JID (Case sensitive check)
                _converse.roster.create({
                    jid: mock.pend_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'none',
                    ask: 'subscribe',
                    fullname: mock.pend_names[0]
                });
                _converse.roster.create({
                    jid: mock.pend_names[0].replace(/ /g,'.') + '@localhost',
                    subscription: 'none',
                    ask: 'subscribe',
                    fullname: mock.pend_names[0]
                });
            });
            waits(300);
            runs(function () {
                // Checking that only one entry is created because both JID is same (Case sensitive check)
                expect(_converse.rosterview.$el.find('dd:visible').length).toBe(1);
                expect(_converse.rosterview.update).toHaveBeenCalled();
            });
        }));

    });

    describe("The Controlbox Tabs", function () {

        it("contains two tabs, 'Contacts' and 'ChatRooms'", mock.initConverse(function (_converse) {
            test_utils.openControlBox();
            var cbview = _converse.chatboxviews.get('controlbox');
            var $panels = cbview.$el.find('.controlbox-panes');
            expect($panels.children().length).toBe(2);
            expect($panels.children().first().attr('id')).toBe('users');
            expect($panels.children().first().is(':visible')).toBe(true);
            expect($panels.children().last().attr('id')).toBe('chatrooms');
            expect($panels.children().last().is(':visible')).toBe(false);
        }));

        it("remembers which tab was open last", mock.initConverse(function (_converse) {
            test_utils.openControlBox();
            var cbview = _converse.chatboxviews.get('controlbox');
            var $tabs = cbview.$el.find('#controlbox-tabs');
            expect(cbview.model.get('active-panel')).toBe('users');
            $tabs.find('li').last().find('a').click();
            expect(cbview.model.get('active-panel')).toBe('chatrooms');
            $tabs.find('li').first().find('a').click();
            expect(cbview.model.get('active-panel')).toBe('users');
        }));

        describe("chatrooms panel", function () {

            it("is opened by clicking the 'Chatrooms' tab", mock.initConverse(function (_converse) {
                test_utils.openControlBox();
                var cbview = _converse.chatboxviews.get('controlbox');
                var $tabs = cbview.$el.find('#controlbox-tabs');
                var $panels = cbview.$el.find('.controlbox-panes');
                var $contacts = $panels.children().first();
                var $chatrooms = $panels.children().last();
                spyOn(cbview, 'switchTab').andCallThrough();
                cbview.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                $tabs.find('li').last().find('a').click(); // Clicks the chatrooms tab
                expect($contacts.is(':visible')).toBe(false);
                expect($chatrooms.is(':visible')).toBe(true);
                expect(cbview.switchTab).toHaveBeenCalled();
            }));

            it("contains a form through which a new chatroom can be created", mock.initConverse(function (_converse) {
                test_utils.openControlBox();
                var roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                var $input = roomspanel.$el.find('input.new-chatroom-name');
                var $nick = roomspanel.$el.find('input.new-chatroom-nick');
                var $server = roomspanel.$el.find('input.new-chatroom-server');
                expect($input.length).toBe(1);
                expect($server.length).toBe(1);
                expect($('.chatroom:visible').length).toBe(0); // There shouldn't be any chatrooms open currently
                spyOn(roomspanel, 'createChatRoom').andCallThrough();
                spyOn(_converse.ChatRoomView.prototype, 'getRoomFeatures').andCallFake(function () {
                    var deferred = new $.Deferred();
                    deferred.resolve();
                    return deferred.promise();
                });

                roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                runs(function () {
                    $input.val('Lounge');
                    $nick.val('dummy');
                    $server.val('muc.localhost');
                    roomspanel.$el.find('form').submit();
                    expect(roomspanel.createChatRoom).toHaveBeenCalled();
                });
                waits('250');
                runs(function () {
                    expect($('.chatroom:visible').length).toBe(1); // There should now be an open chatroom
                });
            }));

            it("can list rooms publically available on the server", mock.initConverse(function (_converse) {
                test_utils.openControlBox();
                var panel = _converse.chatboxviews.get('controlbox').roomspanel;
                panel.$tabs.find('li').last().find('a').click(); // Click the chatrooms tab
                panel.model.set({'muc_domain': 'muc.localhost'}); // Make sure the domain is set
                // See: http://xmpp.org/extensions/xep-0045.html#disco-rooms
                expect($('#available-chatrooms').children('dt').length).toBe(0);
                expect($('#available-chatrooms').children('dd').length).toBe(0);

                var iq = $iq({
                    from:'muc.localhost',
                    to:'dummy@localhost/pda',
                    type:'result'
                }).c('query')
                  .c('item', { jid:'heath@chat.shakespeare.lit', name:'A Lonely Heath'}).up()
                  .c('item', { jid:'coven@chat.shakespeare.lit', name:'A Dark Cave'}).up()
                  .c('item', { jid:'forres@chat.shakespeare.lit', name:'The Palace'}).up()
                  .c('item', { jid:'inverness@chat.shakespeare.lit', name:'Macbeth&apos;s Castle'}).nodeTree;

                panel.onRoomsFound(iq);
                expect(panel.$('#available-chatrooms').children('dt').length).toBe(1);
                expect(panel.$('#available-chatrooms').children('dt').first().text()).toBe("Rooms on muc.localhost");
                expect(panel.$('#available-chatrooms').children('dd').length).toBe(4);
            }));
        });
    });
}));
