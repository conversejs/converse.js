/*global converse */
(function (root, factory) {
    define([
        "jquery",
        "underscore",
        "mock",
        "test_utils"
        ], function ($, _, mock, test_utils) {
            return factory($, _, mock, test_utils);
        }
    );
} (this, function ($, _, mock, test_utils) {
    var $pres = converse_api.env.$pres;
    var $iq = converse_api.env.$iq;

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

    describe("The Control Box", $.proxy(function (mock, test_utils) {
        beforeEach(function () {
            runs(function () {
                test_utils.openControlBox();
            });
        });

        it("can be opened by clicking a DOM element with class 'toggle-controlbox'", $.proxy(function () {
            runs(function () {
                test_utils.closeControlBox();
            });
            waits(50);
            runs(function () {
                // This spec will only pass if the controlbox is not currently
                // open yet.
                expect($("div#controlbox").is(':visible')).toBe(false);
                spyOn(this.controlboxtoggle, 'onClick').andCallThrough();
                spyOn(this.controlboxtoggle, 'showControlBox').andCallThrough();
                spyOn(converse, 'emit');
                // Redelegate so that the spies are now registered as the event handlers (specifically for 'onClick')
                this.controlboxtoggle.delegateEvents();
                $('.toggle-controlbox').click();
            }.bind(converse));
            waits(50);
            runs(function () {
                expect(this.controlboxtoggle.onClick).toHaveBeenCalled();
                expect(this.controlboxtoggle.showControlBox).toHaveBeenCalled();
                expect(this.emit).toHaveBeenCalledWith('controlBoxOpened', jasmine.any(Object));
                expect($("div#controlbox").is(':visible')).toBe(true);
            }.bind(converse));
        }, converse));

        describe("The Status Widget", $.proxy(function () {

            beforeEach(function () {
                test_utils.openControlBox();
            });

            it("shows the user's chat status, which is online by default", $.proxy(function () {
                var view = this.xmppstatusview;
                expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(true);
                expect(view.$el.find('a.choose-xmpp-status').attr('data-value')).toBe('I am online');
            }, converse));

            it("can be used to set the current user's chat status", $.proxy(function () {
                var view = this.xmppstatusview;
                spyOn(view, 'toggleOptions').andCallThrough();
                spyOn(view, 'setStatus').andCallThrough();
                spyOn(converse, 'emit');
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
                    expect(converse.emit).toHaveBeenCalledWith('statusChanged', 'dnd');
                });
                waits(250);
                runs($.proxy(function () {
                    expect(view.updateStatusUI).toHaveBeenCalled();
                    expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(false);
                    expect(view.$el.find('a.choose-xmpp-status').hasClass('dnd')).toBe(true);
                    expect(view.$el.find('a.choose-xmpp-status').attr('data-value')).toBe('I am busy');
                }, converse));
            }, converse));

            it("can be used to set a custom status message", $.proxy(function () {
                var view = this.xmppstatusview;
                this.xmppstatus.save({'status': 'online'});
                spyOn(view, 'setStatusMessage').andCallThrough();
                spyOn(view, 'renderStatusChangeForm').andCallThrough();
                spyOn(converse, 'emit');
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
                    expect(converse.emit).toHaveBeenCalledWith('statusMessageChanged', msg);
                    expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(true);
                    expect(view.$el.find('a.choose-xmpp-status').attr('data-value')).toBe(msg);
                });
            }, converse));
        }, converse));
    }, converse, mock, test_utils));

    describe("The Contacts Roster", $.proxy(function (mock, utils) {
        function _clearContacts () {
            utils.clearBrowserStorage();
            converse.rosterview.model.reset();
        }

        describe("The live filter", $.proxy(function () {
            beforeEach(function () {
                test_utils.openControlBox();
                test_utils.openContactsPanel();
            });

            it("will only appear when roster contacts flow over the visible area", function () {
                var $filter = converse.rosterview.$('.roster-filter');
                var names = mock.cur_names;
                runs(function () {
                    _clearContacts();
                    converse.rosterview.update(); // XXX: Will normally called as event handler
                });
                waits(5); // Needed, due to debounce
                runs(function () {
                    expect($filter.length).toBe(1);
                    expect($filter.is(':visible')).toBeFalsy();
                    for (var i=0; i<names.length; i++) {
                        converse.roster.create({
                            ask: null,
                            fullname: names[i],
                            jid: names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                            requesting: 'false',
                            subscription: 'both'
                        });
                        converse.rosterview.update(); // XXX: Will normally called as event handler
                    }
                });
                waits(5); // Needed, due to debounce
                runs(function () {
                    $filter = converse.rosterview.$('.roster-filter');
                    if (converse.rosterview.$roster.hasScrollBar()) {
                        expect($filter.is(':visible')).toBeTruthy();
                    } else {
                        expect($filter.is(':visible')).toBeFalsy();
                    }
                });
            });

            it("can be used to filter the contacts shown", function () {
                var $filter;
                var $roster;
                runs(function () {
                    _clearContacts();
                    converse.roster_groups = true;
                    utils.createGroupedContacts();
                    $filter = converse.rosterview.$('.roster-filter');
                    $roster = converse.rosterview.$roster;
                });
                waits(5); // Needed, due to debounce in "update" method
                runs(function () {
                    converse.rosterview.filter_view.delegateEvents();
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
                    $filter = converse.rosterview.$('.roster-filter');
                    $filter.val("an");
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dd:visible').length).toBe(5);
                    expect($roster.find('dt:visible').length).toBe(4);
                    $filter = converse.rosterview.$('.roster-filter');
                    $filter.val("xxx");
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dd:visible').length).toBe(0);
                    expect($roster.find('dt:visible').length).toBe(0);
                    $filter = converse.rosterview.$('.roster-filter');
                    $filter.val("");  // Check that contacts are shown again, when the filter string is cleared.
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs(function () {
                    expect($roster.find('dd:visible').length).toBe(15);
                    expect($roster.find('dt:visible').length).toBe(5);
                });
                converse.roster_groups = false;
            });

            it("can be used to filter the groups shown", function () {
                var $filter;
                var $roster;
                var $type;
                runs(function () {
                    converse.roster_groups = true;
                    _clearContacts();
                    utils.createGroupedContacts();
                    converse.rosterview.filter_view.delegateEvents();
                    $filter = converse.rosterview.$('.roster-filter');
                    $roster = converse.rosterview.$roster;
                    $type = converse.rosterview.$('.filter-type');
                    $type.val('groups');
                });
                waits(550); // Needed, due to debounce
                runs(function () {
                    expect($roster.find('dd:visible').length).toBe(15);
                    expect($roster.find('dt:visible').length).toBe(5);
                    $filter.val("colleagues");
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
                    $filter = converse.rosterview.$('.roster-filter');
                    $filter.val("xxx");
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dt:visible').length).toBe(0);
                    $filter = converse.rosterview.$('.roster-filter');
                    $filter.val(""); // Check that groups are shown again, when the filter string is cleared.
                    $filter.trigger('keydown');
                });
                waits(550); // Needed, due to debounce
                runs(function () {
                    expect($roster.find('dd:visible').length).toBe(15);
                    expect($roster.find('dt:visible').length).toBe(5);
                });
                converse.roster_groups = false;
            });

            it("has a button with which its contents can be cleared", function () {
                converse.roster_groups = true;
                _clearContacts();
                utils.createGroupedContacts();
                var $filter = converse.rosterview.$('.roster-filter');
                runs (function () {
                    converse.rosterview.filter_view.delegateEvents();
                    $filter.val("xxx");
                    $filter.trigger('keydown');
                    expect($filter.hasClass("x")).toBeFalsy();
                });
                waits(550); // Needed, due to debounce
                runs (function () {
                    $filter = converse.rosterview.$('.roster-filter');
                    expect($filter.hasClass("x")).toBeTruthy();
                    $filter.addClass("onX").click();
                    expect($filter.val()).toBe("");
                });
                converse.roster_groups = false;
            });
        }, converse));

        describe("A Roster Group", $.proxy(function () {
            beforeEach(function () {
                converse.roster_groups = true;
            });
            afterEach(function () {
                converse.roster_groups = false;
            });

            it("can be used to organize existing contacts", $.proxy(function () {
                runs($.proxy(function () {
                    _clearContacts();
                    spyOn(converse, 'emit');
                    spyOn(this.rosterview, 'update').andCallThrough();
                    converse.rosterview.render();
                    utils.createContacts('pending');
                    utils.createContacts('requesting');
                    utils.createGroupedContacts();
                }, this));
                waits(50); // Needed, due to debounce
                runs($.proxy(function () {
                    // Check that the groups appear alphabetically and that
                    // requesting and pending contacts are last.
                    var group_titles = $.map(this.rosterview.$el.find('dt'), function (o) { return $(o).text().trim(); });
                    expect(group_titles).toEqual([
                        "colleagues",
                        "Family",
                        "friends & acquaintences",
                        "ænemies",
                        "Ungrouped",
                        "Contact requests",
                        "Pending contacts"
                    ]);
                    // Check that usernames appear alphabetically per group
                    _.each(_.keys(mock.groups), $.proxy(function (name) {
                        var $contacts = this.rosterview.$('dt.roster-group[data-group="'+name+'"]').nextUntil('dt', 'dd');
                        var names = $.map($contacts, function (o) { return $(o).text().trim(); });
                        expect(names).toEqual(_.clone(names).sort());
                    }, converse));
                }, this));
            }, converse));

            it("can share contacts with other roster groups", $.proxy(function () {
                var groups = ['colleagues', 'friends'];
                runs($.proxy(function () {
                    _clearContacts();
                    var i=0;
                    spyOn(converse, 'emit');
                    spyOn(this.rosterview, 'update').andCallThrough();
                    converse.rosterview.render();
                    for (i=0; i<mock.cur_names.length; i++) {
                        this.roster.create({
                            jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                            subscription: 'both',
                            ask: null,
                            groups: groups,
                            fullname: mock.cur_names[i]
                        });
                    }
                }, this));
                waits(50); // Needed, due to debounce
                runs($.proxy(function () {
                    // Check that usernames appear alphabetically per group
                    _.each(groups, $.proxy(function (name) {
                        var $contacts = this.rosterview.$('dt.roster-group[data-group="'+name+'"]').nextUntil('dt', 'dd');
                        var names = $.map($contacts, function (o) { return $(o).text().trim(); });
                        expect(names).toEqual(_.clone(names).sort());
                        expect(names.length).toEqual(mock.cur_names.length);
                    }, this));
                }, this));
            }, converse));

            it("remembers whether it is closed or opened", $.proxy(function () {
                var i=0, j=0;
                var groups = {
                    'colleagues': 3,
                    'friends & acquaintences': 3,
                    'Ungrouped': 2
                };
                _.each(_.keys(groups), $.proxy(function (name) {
                    j = i;
                    for (i=j; i<j+groups[name]; i++) {
                        this.roster.create({
                            jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                            subscription: 'both',
                            ask: null,
                            groups: name === 'ungrouped'? [] : [name],
                            fullname: mock.cur_names[i]
                        });
                    }
                }, converse));
                var view = this.rosterview.get('colleagues');
                var $toggle = view.$el.find('a.group-toggle');
                expect(view.model.get('state')).toBe('opened');
                $toggle.click();
                expect(view.model.get('state')).toBe('closed');
                $toggle.click();
                expect(view.model.get('state')).toBe('opened');
            }, converse));
        }, converse));

        describe("Pending Contacts", $.proxy(function () {
            function _clearContacts () {
                utils.clearBrowserStorage();
                converse.rosterview.model.reset();
            }

            function _addContacts () {
                _clearContacts();
                // Must be initialized, so that render is called and documentFragment set up.
                utils.createContacts('pending').openControlBox().openContactsPanel();
            }

            it("can be collapsed under their own header", $.proxy(function () {
                runs(function () {
                    _addContacts();
                });
                waits(50);
                runs($.proxy(function () {
                    checkHeaderToggling.apply(this, [this.rosterview.get('Pending contacts').$el]);
                }, this));
            }, converse));

            it("can be added to the roster", $.proxy(function () {
                _clearContacts();
                spyOn(converse, 'emit');
                spyOn(this.rosterview, 'update').andCallThrough();
                runs($.proxy(function () {
                    this.roster.create({
                        jid: mock.pend_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: 'subscribe',
                        fullname: mock.pend_names[0]
                    });
                }, converse));
                waits(300);
                runs($.proxy(function () {
                    expect(this.rosterview.$el.is(':visible')).toEqual(true);
                    expect(this.rosterview.update).toHaveBeenCalled();
                }, converse));
            }, converse));

            it("are shown in the roster when show_only_online_users", $.proxy(function () {
                converse.show_only_online_users = true;
                runs(function () {
                    _addContacts();
                });
                waits(50);
                spyOn(this.rosterview, 'update').andCallThrough();
                runs($.proxy(function () {
                    expect(this.rosterview.$el.is(':visible')).toEqual(true);
                    expect(this.rosterview.update).toHaveBeenCalled();
                }, converse));
                waits(300); // Needed, due to debounce
                runs ($.proxy(function () {
                    expect(this.rosterview.$el.find('dd:visible').length).toBe(3);
                    expect(this.rosterview.$el.find('dt:visible').length).toBe(1);
                }, converse));
                converse.show_only_online_users = false;
            }, converse));

            it("are shown in the roster when hide_offline_users", $.proxy(function () {
                converse.hide_offline_users = true;
                runs(function () {
                    _addContacts();
                });
                waits(50);
                spyOn(this.rosterview, 'update').andCallThrough();
                runs($.proxy(function () {
                    expect(this.rosterview.$el.is(':visible')).toEqual(true);
                    expect(this.rosterview.update).toHaveBeenCalled();
                }, converse));
                waits(300); // Needed, due to debounce
                runs ($.proxy(function () {
                    expect(this.rosterview.$el.find('dd:visible').length).toBe(3);
                    expect(this.rosterview.$el.find('dt:visible').length).toBe(1);
                }, converse));
                converse.hide_offline_users = false;
            }, converse));

            it("can be removed by the user", $.proxy(function () {
                runs($.proxy(function () {
                    _addContacts();
                }, this));
                waits(50);
                runs($.proxy(function () {
                    var name = mock.pend_names[0];
                    var jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var contact = this.roster.get(jid);
                    spyOn(window, 'confirm').andReturn(true);
                    spyOn(contact, 'unauthorize').andCallFake(function () { return contact; });
                    spyOn(contact, 'removeFromRoster');
                    spyOn(this.connection, 'sendIQ').andCallFake(function (iq, callback) {
                        if (typeof callback === "function") { return callback(); }
                    });

                    converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')")
                        .siblings('.remove-xmpp-contact').click();

                    expect(window.confirm).toHaveBeenCalled();
                    expect(converse.connection.sendIQ).toHaveBeenCalled();
                    expect(contact.removeFromRoster).toHaveBeenCalled();
                    expect(this.connection.sendIQ).toHaveBeenCalled();
                    expect(converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')").length).toEqual(0);
                }, this));
            }, converse));

            it("do not have a header if there aren't any", $.proxy(function () {
                var name = mock.pend_names[0];
                runs($.proxy(function () {
                    _clearContacts();
                }, this));
                waits(50);
                runs($.proxy(function () {
                    this.roster.create({
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: 'subscribe',
                        fullname: name
                    });
                    spyOn(window, 'confirm').andReturn(true);
                    spyOn(this.connection, 'sendIQ').andCallFake(function (iq, callback) {
                        if (typeof callback === "function") { return callback(); }
                    });
                    expect(this.rosterview.get('Pending contacts').$el.is(':visible')).toEqual(true);
                    converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')")
                        .siblings('.remove-xmpp-contact').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(this.connection.sendIQ).toHaveBeenCalled();
                    expect(this.rosterview.get('Pending contacts').$el.is(':visible')).toEqual(false);
                }, this));
            }, converse));


            it("will lose their own header once the last one has been removed", $.proxy(function () {
                _addContacts();
                var name;
                spyOn(window, 'confirm').andReturn(true);
                for (var i=0; i<mock.pend_names.length; i++) {
                    name = mock.pend_names[i];
                    converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')")
                        .siblings('.remove-xmpp-contact').click();
                }
                expect(this.rosterview.$el.find('dt#pending-xmpp-contacts').is(':visible')).toBeFalsy();
            }, converse));

            it("can be added to the roster and they will be sorted alphabetically", $.proxy(function () {
                _clearContacts();
                var i, t;
                spyOn(converse, 'emit');
                spyOn(this.rosterview, 'update').andCallThrough();
                for (i=0; i<mock.pend_names.length; i++) {
                    this.roster.create({
                        jid: mock.pend_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: 'subscribe',
                        fullname: mock.pend_names[i]
                    });
                    expect(this.rosterview.update).toHaveBeenCalled();
                }
                // Check that they are sorted alphabetically
                t = this.rosterview.get('Pending contacts').$el.siblings('dd.pending-xmpp-contact').find('span').text();
                expect(t).toEqual(mock.pend_names.slice(0,i+1).sort().join(''));
            }, converse));

        }, converse));

        describe("Existing Contacts", $.proxy(function () {
            function _clearContacts () {
                utils.clearBrowserStorage();
                converse.rosterview.model.reset();
            }

            var _addContacts = function () {
                _clearContacts();
                utils.createContacts('current').openControlBox().openContactsPanel();
            };

            it("can be collapsed under their own header", $.proxy(function () {
                runs(function () {
                    _addContacts();
                });
                waits(50);
                runs($.proxy(function () {
                    checkHeaderToggling.apply(this, [this.rosterview.$el.find('dt.roster-group')]);
                }, this));
            }, converse));

            it("will be hidden when appearing under a collapsed group", $.proxy(function () {
                _addContacts();
                this.rosterview.$el.find('dt.roster-group').find('a.group-toggle').click();
                var name = "Max Mustermann";
                var jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                converse.roster.create({
                    ask: null,
                    fullname: name,
                    jid: jid,
                    requesting: false,
                    subscription: 'both'
                });
                var view = this.rosterview.get('My contacts').get(jid);
                expect(view.$el.is(':visible')).toBe(false);
            }, converse));

            it("can be added to the roster and they will be sorted alphabetically", $.proxy(function () {
                runs(function () {
                    _clearContacts();
                });
                waits(50);
                runs($.proxy(function () {
                    var i, t;
                    spyOn(this.rosterview, 'update').andCallThrough();
                    for (i=0; i<mock.cur_names.length; i++) {
                        this.roster.create({
                            jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                            subscription: 'both',
                            ask: null,
                            fullname: mock.cur_names[i]
                        });
                        expect(this.rosterview.update).toHaveBeenCalled();
                    }
                    // Check that they are sorted alphabetically
                    t = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.offline').find('a.open-chat').text();
                    expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                }, this));
            }, converse));

            it("can be removed by the user", $.proxy(function () {
                runs(function () {
                    _addContacts();
                });
                waits(50);
                runs($.proxy(function () {
                    var name = mock.cur_names[0];
                    var jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var contact = this.roster.get(jid);
                    spyOn(window, 'confirm').andReturn(true);
                    spyOn(contact, 'removeFromRoster');
                    spyOn(this.connection, 'sendIQ').andCallFake(function (iq, callback) {
                        if (typeof callback === "function") { return callback(); }
                    });

                    converse.rosterview.$el.find(".open-chat:contains('"+name+"')")
                        .siblings('.remove-xmpp-contact').click();

                    expect(window.confirm).toHaveBeenCalled();
                    expect(converse.connection.sendIQ).toHaveBeenCalled();
                    expect(contact.removeFromRoster).toHaveBeenCalled();
                    expect(converse.rosterview.$el.find(".open-chat:contains('"+name+"')").length).toEqual(0);
                }, this));
            }, converse));


            it("do not have a header if there aren't any", $.proxy(function () {
                var name = mock.cur_names[0];
                runs(function () {
                    _clearContacts();
                });
                waits(50);
                runs($.proxy(function () {
                    var contact = this.roster.create({
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'both',
                        ask: null,
                        fullname: name
                    });
                    spyOn(window, 'confirm').andReturn(true);
                    spyOn(contact, 'removeFromRoster');
                    spyOn(this.connection, 'sendIQ').andCallFake(function (iq, callback) {
                        if (typeof callback === "function") { return callback(); }
                    });

                    expect(this.rosterview.$el.find('dt.roster-group').css('display')).toEqual('block');
                    converse.rosterview.$el.find(".open-chat:contains('"+name+"')")
                        .siblings('.remove-xmpp-contact').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(this.connection.sendIQ).toHaveBeenCalled();
                    expect(contact.removeFromRoster).toHaveBeenCalled();
                    expect(this.rosterview.$el.find('dt.roster-group').css('display')).toEqual('none');
                }, this));
            }, converse));

            it("can change their status to online and be sorted alphabetically", $.proxy(function () {
                runs(function () {
                    _addContacts();
                });
                waits(50);
                runs($.proxy(function () {
                    var jid, t;
                    spyOn(converse, 'emit');
                    spyOn(this.rosterview, 'update').andCallThrough();
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        this.roster.get(jid).set('chat_status', 'online');
                        expect(this.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.online').find('a.open-chat').text();
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                }, this));
            }, converse));

            it("can change their status to busy and be sorted alphabetically", $.proxy(function () {
                runs(function () {
                    _addContacts();
                });
                waits(50);
                runs($.proxy(function () {
                    var jid, t;
                    spyOn(converse, 'emit');
                    spyOn(this.rosterview, 'update').andCallThrough();
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        this.roster.get(jid).set('chat_status', 'dnd');
                        expect(this.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.dnd').find('a.open-chat').text();
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                }, this));
            }, converse));

            it("can change their status to away and be sorted alphabetically", $.proxy(function () {
                runs(function () {
                    _addContacts();
                });
                waits(50);
                runs($.proxy(function () {
                    var jid, t;
                    spyOn(converse, 'emit');
                    spyOn(this.rosterview, 'update').andCallThrough();
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        this.roster.get(jid).set('chat_status', 'away');
                        expect(this.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.away').find('a.open-chat').text();
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                }, this));
            }, converse));

            it("can change their status to xa and be sorted alphabetically", $.proxy(function () {
                runs(function () {
                    _addContacts();
                });
                waits(50);
                runs($.proxy(function () {
                    var jid, t;
                    spyOn(converse, 'emit');
                    spyOn(this.rosterview, 'update').andCallThrough();
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        this.roster.get(jid).set('chat_status', 'xa');
                        expect(this.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.xa').find('a.open-chat').text();
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                }, this));
            }, converse));

            it("can change their status to unavailable and be sorted alphabetically", $.proxy(function () {
                runs(function () {
                    _addContacts();
                });
                waits(50);
                runs($.proxy(function () {
                    var jid, t;
                    spyOn(converse, 'emit');
                    spyOn(this.rosterview, 'update').andCallThrough();
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        this.roster.get(jid).set('chat_status', 'unavailable');
                        expect(this.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.unavailable').find('a.open-chat').text();
                        expect(t).toEqual(mock.cur_names.slice(0, i+1).sort().join(''));
                    }
                }, this));
            }, converse));

            it("are ordered according to status: online, busy, away, xa, unavailable, offline", $.proxy(function () {
                runs(function () {
                    _addContacts();
                });
                waits(50);
                runs($.proxy(function () {
                    var i, jid;
                    for (i=0; i<3; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        this.roster.get(jid).set('chat_status', 'online');
                    }
                    for (i=3; i<6; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        this.roster.get(jid).set('chat_status', 'dnd');
                    }
                    for (i=6; i<9; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        this.roster.get(jid).set('chat_status', 'away');
                    }
                    for (i=9; i<12; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        this.roster.get(jid).set('chat_status', 'xa');
                    }
                    for (i=12; i<15; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        this.roster.get(jid).set('chat_status', 'unavailable');
                    }

                    var contacts = this.rosterview.$el.find('dd.current-xmpp-contact');
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
                }, this));
            }, converse));
        }, converse));

        describe("Requesting Contacts", $.proxy(function () {
            beforeEach($.proxy(function () {
                runs(function () {
                    utils.clearBrowserStorage();
                    converse.rosterview.model.reset();
                    utils.createContacts('requesting').openControlBox();
                });
                waits(50);
                runs(function () {
                    utils.openContactsPanel();
                });
            }, converse));

            it("can be added to the roster and they will be sorted alphabetically", $.proxy(function () {
                converse.rosterview.model.reset(); // We want to manually create users so that we can spy
                var i, children;
                var names = [];
                spyOn(converse, 'emit');
                spyOn(this.rosterview, 'update').andCallThrough();
                spyOn(this.controlboxtoggle, 'showControlBox').andCallThrough();
                var addName = function (idx, item) {
                    if (!$(item).hasClass('request-actions')) {
                        names.push($(item).text().replace(/^\s+|\s+$/g, ''));
                    }
                };
                for (i=0; i<mock.req_names.length; i++) {
                    this.roster.create({
                        jid: mock.req_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: null,
                        requesting: true,
                        fullname: mock.req_names[i]
                    });
                    expect(this.rosterview.update).toHaveBeenCalled();
                    // When a requesting contact is added, the controlbox must
                    // be opened.
                    expect(this.controlboxtoggle.showControlBox).toHaveBeenCalled();
                }
                // Check that they are sorted alphabetically
                children = this.rosterview.get('Contact requests').$el.siblings('dd.requesting-xmpp-contact').children('span');
                names = [];
                children.each(addName);
                expect(names.join('')).toEqual(mock.req_names.slice(0,i+1).sort().join(''));
            }, converse));

            it("do not have a header if there aren't any", $.proxy(function () {
                converse.rosterview.model.reset(); // We want to manually create users so that we can spy
                var name = mock.req_names[0];
                runs($.proxy(function () {
                    spyOn(window, 'confirm').andReturn(true);
                    this.roster.create({
                        jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: null,
                        requesting: true,
                        fullname: name
                    });
                }, this));
                waits(50);
                runs($.proxy(function () {
                    expect(this.rosterview.get('Contact requests').$el.is(':visible')).toEqual(true);
                    converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                        .siblings('.request-actions')
                        .find('.decline-xmpp-request').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(this.rosterview.get('Contact requests').$el.is(':visible')).toEqual(false);
                }, this));
            }, converse));

            it("can be collapsed under their own header", $.proxy(function () {
                checkHeaderToggling.apply(this, [this.rosterview.get('Contact requests').$el]);
            }, converse));

            it("can have their requests accepted by the user", $.proxy(function () {
                // TODO: Testing can be more thorough here, the user is
                // actually not accepted/authorized because of
                // mock_connection.
                var name = mock.req_names.sort()[0];
                var jid =  name.replace(/ /g,'.').toLowerCase() + '@localhost';
                var contact = this.roster.get(jid);
                spyOn(converse.roster, 'sendContactAddIQ').andCallFake(function (jid, fullname, groups, callback) {
                    callback();
                });
                spyOn(contact, 'authorize').andCallFake(function () { return contact; });
                converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                    .siblings('.request-actions')
                    .find('.accept-xmpp-request').click();
                expect(converse.roster.sendContactAddIQ).toHaveBeenCalled();
                expect(contact.authorize).toHaveBeenCalled();
            }, converse));

            it("can have their requests denied by the user", $.proxy(function () {
                this.rosterview.model.reset();
                runs($.proxy(function () {
                    utils.createContacts('requesting').openControlBox();
                    converse.rosterview.update(); // XXX: Hack to make sure $roster element is attaced.
                }, this));
                waits(50);
                runs($.proxy(function () {
                    var name = mock.req_names.sort()[1];
                    var jid =  name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var contact = this.roster.get(jid);
                    spyOn(window, 'confirm').andReturn(true);
                    spyOn(contact, 'unauthorize').andCallFake(function () { return contact; });
                    converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                        .siblings('.request-actions')
                        .find('.decline-xmpp-request').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(contact.unauthorize).toHaveBeenCalled();
                    // There should now be one less contact
                    expect(this.roster.length).toEqual(mock.req_names.length-1);
                }, this));
            }, converse));

            it("are persisted even if other contacts' change their presence ", $.proxy(function() {
                /* This is a regression test.
                 * https://github.com/jcbrand/converse.js/issues/262
                 */
                this.rosterview.model.reset();
                expect(this.roster.pluck('jid').length).toBe(0);

                var stanza = $pres({from: 'data@enterprise/resource', type: 'subscribe'});
                this.connection._dataRecv(test_utils.createRequest(stanza));
                expect(this.roster.pluck('jid').length).toBe(1);
                expect(_.contains(this.roster.pluck('jid'), 'data@enterprise')).toBeTruthy();

                // Taken from the spec
                // http://xmpp.org/rfcs/rfc3921.html#rfc.section.7.3
                stanza = $iq({
                    to: this.connection.jid,
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
                this.roster.onReceivedFromServer(stanza.tree());
                expect(_.contains(this.roster.pluck('jid'), 'data@enterprise')).toBeTruthy();
            }, converse));

        }, converse));

        describe("All Contacts", $.proxy(function () {
            beforeEach($.proxy(function () {
                runs(function () {
                    utils.clearBrowserStorage();
                    converse.rosterview.model.reset();
                    utils.createContacts('all').openControlBox();
                });
                waits(50);
                runs(function () {
                    utils.openContactsPanel();
                });
            }, converse));

            it("are saved to, and can be retrieved from, browserStorage", $.proxy(function () {
                var new_attrs, old_attrs, attrs;
                var num_contacts = this.roster.length;
                var new_roster = new this.RosterContacts();
                // Roster items are yet to be fetched from browserStorage
                expect(new_roster.length).toEqual(0);
                new_roster.browserStorage = this.roster.browserStorage;
                new_roster.fetch();
                expect(new_roster.length).toEqual(num_contacts);
                // Check that the roster items retrieved from browserStorage
                // have the same attributes values as the original ones.
                attrs = ['jid', 'fullname', 'subscription', 'ask'];
                for (var i=0; i<attrs.length; i++) {
                    new_attrs = _.pluck(_.pluck(new_roster.models, 'attributes'), attrs[i]);
                    old_attrs = _.pluck(_.pluck(this.roster.models, 'attributes'), attrs[i]);
                    // Roster items in storage are not necessarily sorted,
                    // so we have to sort them here to do a proper
                    // comparison
                    expect(_.isEqual(new_attrs.sort(), old_attrs.sort())).toEqual(true);
                }
            }, converse));

            it("will show fullname and jid properties on tooltip", $.proxy(function () {
                var jid, name, i;
                for (i=0; i<mock.cur_names.length; i++) {
                    name = mock.cur_names[i];
                    jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var $dd = this.rosterview.$el.find("dd:contains('"+name+"')").children().first();
                    var dd_text = $dd.text();
                    var dd_title = $dd.attr('title');
                    expect(dd_text).toBe(name);
                    expect(dd_title).toContain(name);
                    expect(dd_title).toContain(jid);
                }
            }, converse));

        }, converse));
    }, converse, mock, test_utils));

    describe("The 'Add Contact' widget", $.proxy(function (mock, test_utils) {
        it("opens up an add form when you click on it", $.proxy(function () {
            var panel = this.chatboxviews.get('controlbox').contactspanel;
            spyOn(panel, 'toggleContactForm').andCallThrough();
            panel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
            panel.$el.find('a.toggle-xmpp-contact-form').click();
            expect(panel.toggleContactForm).toHaveBeenCalled();
            // XXX: Awaiting more tests, close it again for now...
            panel.$el.find('a.toggle-xmpp-contact-form').click();
        }, converse));

    }, converse, mock, test_utils));

    describe("The Controlbox Tabs", $.proxy(function () {
        beforeEach($.proxy(function () {
            runs(function () {
                test_utils.closeAllChatBoxes();
            });
            waits(50);
            runs(function () {
                test_utils.openControlBox();
            });
        }, converse));

        it("contains two tabs, 'Contacts' and 'ChatRooms'", $.proxy(function () {
            var cbview = this.chatboxviews.get('controlbox');
            var $panels = cbview.$el.find('.controlbox-panes');
            expect($panels.children().length).toBe(2);
            expect($panels.children().first().attr('id')).toBe('users');
            expect($panels.children().first().is(':visible')).toBe(true);
            expect($panels.children().last().attr('id')).toBe('chatrooms');
            expect($panels.children().last().is(':visible')).toBe(false);
        }, converse));

        describe("chatrooms panel", $.proxy(function () {
            beforeEach($.proxy(function () {
                runs(function () {
                    test_utils.closeAllChatBoxes();
                });
                waits(50);
                runs(function () {
                    test_utils.openControlBox();
                });
            }, converse));

            it("is opened by clicking the 'Chatrooms' tab", $.proxy(function () {
                var cbview = this.chatboxviews.get('controlbox');
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
            }, converse));

            it("contains a form through which a new chatroom can be created", $.proxy(function () {
                var roomspanel = this.chatboxviews.get('controlbox').roomspanel;
                var $input = roomspanel.$el.find('input.new-chatroom-name');
                var $nick = roomspanel.$el.find('input.new-chatroom-nick');
                var $server = roomspanel.$el.find('input.new-chatroom-server');
                expect($input.length).toBe(1);
                expect($server.length).toBe(1);
                expect($('.chatroom:visible').length).toBe(0); // There shouldn't be any chatrooms open currently
                spyOn(roomspanel, 'createChatRoom').andCallThrough();
                roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                runs(function () {
                    $input.val('Lounge');
                    $nick.val('dummy');
                    $server.val('muc.localhost');
                });
                waits('250');
                runs(function () {
                    roomspanel.$el.find('form').submit();
                    expect(roomspanel.createChatRoom).toHaveBeenCalled();
                });
                waits('250');
                runs($.proxy(function () {
                    expect($('.chatroom:visible').length).toBe(1); // There should now be an open chatroom
                }, converse));
            }, converse));

            it("can list rooms publically available on the server", $.proxy(function () {
                var panel = this.chatboxviews.get('controlbox').roomspanel;
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
            }, converse));
        }, converse));
    }, converse, mock, test_utils));
}));
