(function (root, factory) {
    define([
        "mock",
        "test_utils"
        ], function (mock, test_utils) {
            return factory(mock, test_utils);
        }
    );
} (this, function (mock, test_utils) {

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
            it("will only appear when roster contacts flow over the visible area", $.proxy(function () {
                _clearContacts();
                var $filter = converse.rosterview.$('.roster-filter');
                var names = mock.cur_names;
                expect($filter.length).toBe(1);
                expect($filter.is(':visible')).toBeFalsy();
                for (i=0; i<names.length; i++) {
                    converse.roster.create({
                        ask: null,
                        fullname: names[i],
                        jid: names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                        requesting: 'false',
                        subscription: 'both'
                    });
                    converse.rosterview.update(); // XXX: Will normally called as event handler
                    if (converse.rosterview.$('.roster-contacts').hasScrollBar()) {
                        expect($filter.is(':visible')).toBeTruthy();
                    } else {
                        expect($filter.is(':visible')).toBeFalsy();
                    }
                }
            }, converse));

            it("can be used to filter the contacts shown", function () {
                converse.roster_groups = true;
                _clearContacts();
                utils.createGroupedContacts();
                var $filter = converse.rosterview.$('.roster-filter');
                var $roster = converse.rosterview.$('.roster-contacts');
                runs(function () {
                    expect($roster.find('dd:visible').length).toBe(15);
                    expect($roster.find('dt:visible').length).toBe(5);
                    $filter.val("candice");
                    expect($roster.find('dd:visible').length).toBe(15); // because no keydown event
                    expect($roster.find('dt:visible').length).toBe(5);  // ditto
                    $filter.trigger('keydown');
                });
                waits(350); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dd:visible').length).toBe(1);
                    expect($roster.find('dd:visible').eq(0).text().trim()).toBe('Candice van der Knijff');
                    expect($roster.find('dt:visible').length).toBe(1);
                    expect($roster.find('dt:visible').eq(0).text()).toBe('colleagues');
                    $filter.val("an");
                    $filter.trigger('keydown');
                });
                waits(350); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dd:visible').length).toBe(5);
                    expect($roster.find('dt:visible').length).toBe(4);
                    $filter.val("xxx");
                    $filter.trigger('keydown');
                });
                waits(350); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dd:visible').length).toBe(0);
                    expect($roster.find('dt:visible').length).toBe(0);
                    $filter.val("");  // Check that contacts are shown again, when the filter string is cleared.
                    $filter.trigger('keydown');
                });
                waits(350); // Needed, due to debounce
                runs(function () {
                    expect($roster.find('dd:visible').length).toBe(15);
                    expect($roster.find('dt:visible').length).toBe(5);
                });
                converse.roster_groups = false;
            });

            it("can be used to filter the groups shown", function () {
                converse.roster_groups = true;
                _clearContacts();
                utils.createGroupedContacts();
                var $filter = converse.rosterview.$('.roster-filter');
                var $roster = converse.rosterview.$('.roster-contacts');
                var $type = converse.rosterview.$('.filter-type');
                $type.val('groups');
                runs(function () {
                    expect($roster.find('dd:visible').length).toBe(15);
                    expect($roster.find('dt:visible').length).toBe(5);
                    $filter.val("colleagues");
                    expect($roster.find('dd:visible').length).toBe(15); // because no keydown event
                    expect($roster.find('dt:visible').length).toBe(5);  // ditto
                    $filter.trigger('keydown');
                });
                waits(350); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dt:visible').length).toBe(1);
                    expect($roster.find('dt:visible').eq(0).text()).toBe('colleagues');
                    // Check that all contacts under the group are shown
                    expect($roster.find('dt:visible').nextUntil('dt', 'dd:hidden').length).toBe(0);
                    $filter.val("xxx");
                    $filter.trigger('keydown');
                });
                waits(350); // Needed, due to debounce
                runs (function () {
                    expect($roster.find('dt:visible').length).toBe(0);
                    $filter.val(""); // Check that groups are shown again, when the filter string is cleared.
                    $filter.trigger('keydown');
                });
                waits(350); // Needed, due to debounce
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
                var $roster = converse.rosterview.$('.roster-contacts');
                runs (function () {
                    $filter.val("xxx");
                    $filter.trigger('keydown');
                    expect($filter.hasClass("x")).toBeFalsy();
                });
                waits(350); // Needed, due to debounce
                runs (function () {
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
                _clearContacts();
                spyOn(converse, 'emit');
                spyOn(this.rosterview, 'update').andCallThrough();
                converse.rosterview.render();
                utils.createContacts('pending');
                utils.createContacts('requesting');
                utils.createGroupedContacts();
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
            }, converse));

            it("can share contacts with other roster groups", $.proxy(function () {
                _clearContacts();
                var i=0, j=0;
                spyOn(converse, 'emit');
                spyOn(this.rosterview, 'update').andCallThrough();
                converse.rosterview.render();
                var groups = ['colleagues', 'friends'];
                for (i=0; i<mock.cur_names.length; i++) {
                    this.roster.create({
                        jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                        subscription: 'both',
                        ask: null,
                        groups: groups,
                        fullname: mock.cur_names[i]
                    });
                }
                // Check that usernames appear alphabetically per group
                _.each(groups, $.proxy(function (name) {
                    var $contacts = this.rosterview.$('dt.roster-group[data-group="'+name+'"]').nextUntil('dt', 'dd');
                    var names = $.map($contacts, function (o) { return $(o).text().trim(); });
                    expect(names).toEqual(_.clone(names).sort());
                    expect(names.length).toEqual(mock.cur_names.length);
                }, converse));
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
                _addContacts();
                checkHeaderToggling.apply(this, [this.rosterview.get('Pending contacts').$el]);
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

            it("can be removed by the user", $.proxy(function () {
                _addContacts();
                var name = mock.pend_names[0];
                var jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                spyOn(window, 'confirm').andReturn(true);
                spyOn(converse, 'emit');
                spyOn(this.connection.roster, 'remove').andCallThrough();
                spyOn(this.connection.roster, 'unauthorize');
                spyOn(this.rosterview.model, 'remove').andCallThrough();

                converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')")
                    .siblings('.remove-xmpp-contact').click();

                expect(window.confirm).toHaveBeenCalled();
                expect(this.connection.roster.remove).toHaveBeenCalled();
                expect(this.connection.roster.unauthorize).toHaveBeenCalled();
                expect(this.rosterview.model.remove).toHaveBeenCalled();
                expect(converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')").length).toEqual(0);
            }, converse));

            it("do not have a header if there aren't any", $.proxy(function () {
                var name = mock.pend_names[0];
                _clearContacts();
                spyOn(window, 'confirm').andReturn(true);
                this.roster.create({
                    jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'none',
                    ask: 'subscribe',
                    fullname: name
                });
                expect(this.rosterview.get('Pending contacts').$el.is(':visible')).toEqual(true);
                converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')")
                    .siblings('.remove-xmpp-contact').click();
                expect(window.confirm).toHaveBeenCalled();
                expect(this.rosterview.get('Pending contacts').$el.is(':visible')).toEqual(false);
            }, converse));


            it("will lose their own header once the last one has been removed", $.proxy(function () {
                _addContacts();
                var name;
                spyOn(window, 'confirm').andReturn(true);
                for (i=0; i<mock.pend_names.length; i++) {
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
                _addContacts();
                checkHeaderToggling.apply(this, [this.rosterview.$el.find('dt.roster-group')]);
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
                _clearContacts();
                var i, t;
                spyOn(converse, 'emit');
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
            }, converse));

            it("can be removed by the user", $.proxy(function () {
                _addContacts();
                var name = mock.cur_names[0];
                var jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                spyOn(window, 'confirm').andReturn(true);
                spyOn(converse, 'emit');
                spyOn(this.connection.roster, 'remove').andCallThrough();
                spyOn(this.connection.roster, 'unauthorize');
                spyOn(this.rosterview.model, 'remove').andCallThrough();

                converse.rosterview.$el.find(".open-chat:contains('"+name+"')")
                    .siblings('.remove-xmpp-contact').click();

                expect(window.confirm).toHaveBeenCalled();
                expect(this.connection.roster.remove).toHaveBeenCalled();
                expect(this.connection.roster.unauthorize).toHaveBeenCalled();
                expect(this.rosterview.model.remove).toHaveBeenCalled();
                expect(converse.rosterview.$el.find(".open-chat:contains('"+name+"')").length).toEqual(0);
            }, converse));


            it("do not have a header if there aren't any", $.proxy(function () {
                var name = mock.cur_names[0];
                _clearContacts();
                spyOn(window, 'confirm').andReturn(true);
                this.roster.create({
                    jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'both',
                    ask: null,
                    fullname: name
                });
                expect(this.rosterview.$el.find('dt.roster-group').css('display')).toEqual('block');
                converse.rosterview.$el.find(".open-chat:contains('"+name+"')")
                    .siblings('.remove-xmpp-contact').click();
                expect(window.confirm).toHaveBeenCalled();
                expect(this.rosterview.$el.find('dt.roster-group').css('display')).toEqual('none');
            }, converse));

            it("can change their status to online and be sorted alphabetically", $.proxy(function () {
                _addContacts();
                var jid, t;
                spyOn(converse, 'emit');
                spyOn(this.rosterview, 'update').andCallThrough();
                for (i=0; i<mock.cur_names.length; i++) {
                    jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                    this.roster.get(jid).set('chat_status', 'online');
                    expect(this.rosterview.update).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.online').find('a.open-chat').text();
                    expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                }
            }, converse));

            it("can change their status to busy and be sorted alphabetically", $.proxy(function () {
                _addContacts();
                var jid, t;
                spyOn(converse, 'emit');
                spyOn(this.rosterview, 'update').andCallThrough();
                for (i=0; i<mock.cur_names.length; i++) {
                    jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                    this.roster.get(jid).set('chat_status', 'dnd');
                    expect(this.rosterview.update).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.dnd').find('a.open-chat').text();
                    expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                }
            }, converse));

            it("can change their status to away and be sorted alphabetically", $.proxy(function () {
                _addContacts();
                var jid, t;
                spyOn(converse, 'emit');
                spyOn(this.rosterview, 'update').andCallThrough();
                for (i=0; i<mock.cur_names.length; i++) {
                    jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                    this.roster.get(jid).set('chat_status', 'away');
                    expect(this.rosterview.update).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.away').find('a.open-chat').text();
                    expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                }
            }, converse));

            it("can change their status to xa and be sorted alphabetically", $.proxy(function () {
                _addContacts();
                var jid, t;
                spyOn(converse, 'emit');
                spyOn(this.rosterview, 'update').andCallThrough();
                for (i=0; i<mock.cur_names.length; i++) {
                    jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                    this.roster.get(jid).set('chat_status', 'xa');
                    expect(this.rosterview.update).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.xa').find('a.open-chat').text();
                    expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                }
            }, converse));

            it("can change their status to unavailable and be sorted alphabetically", $.proxy(function () {
                _addContacts();
                var jid, t;
                spyOn(converse, 'emit');
                spyOn(this.rosterview, 'update').andCallThrough();
                for (i=0; i<mock.cur_names.length; i++) {
                    jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                    this.roster.get(jid).set('chat_status', 'unavailable');
                    expect(this.rosterview.update).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = this.rosterview.$el.find('dt.roster-group').siblings('dd.current-xmpp-contact.unavailable').find('a.open-chat').text();
                    expect(t).toEqual(mock.cur_names.slice(0, i+1).sort().join(''));
                }
            }, converse));

            it("are ordered according to status: online, busy, away, xa, unavailable, offline", $.proxy(function () {
                _addContacts();
                var i;
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
                    expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('online');
                }
                for (i=3; i<6; i++) {
                    expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('dnd');
                }
                for (i=6; i<9; i++) {
                    expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('away');
                }
                for (i=9; i<12; i++) {
                    expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('xa');
                }
                for (i=12; i<15; i++) {
                    expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('unavailable');
                }
                for (i=15; i<mock.cur_names.length; i++) {
                    expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('offline');
                }
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
                spyOn(window, 'confirm').andReturn(true);
                this.roster.create({
                    jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    fullname: name
                });
                expect(this.rosterview.get('Contact requests').$el.is(':visible')).toEqual(true);
                converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                    .siblings('.request-actions')
                    .find('.decline-xmpp-request').click();
                expect(window.confirm).toHaveBeenCalled();
                expect(this.rosterview.get('Contact requests').$el.is(':visible')).toEqual(false);
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
                spyOn(this.connection.roster, 'authorize');

                converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                    .siblings('.request-actions')
                    .find('.accept-xmpp-request').click();

                expect(this.connection.roster.authorize).toHaveBeenCalled();
            }, converse));

            it("can have their requests denied by the user", $.proxy(function () {
                this.rosterview.model.reset();
                spyOn(converse, 'emit');
                spyOn(this.connection.roster, 'unauthorize');
                spyOn(window, 'confirm').andReturn(true);
                utils.createContacts('requesting').openControlBox();
                var name = mock.req_names.sort()[1];
                var jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                    .siblings('.request-actions')
                    .find('.decline-xmpp-request').click();
                expect(window.confirm).toHaveBeenCalled();
                expect(this.connection.roster.unauthorize).toHaveBeenCalled();
                // There should now be one less contact
                expect(this.roster.length).toEqual(mock.req_names.length-1);
            }, converse));
        }, converse));

        describe("All Contacts", $.proxy(function () {
            beforeEach($.proxy(function () {
                utils.clearBrowserStorage();
                converse.rosterview.model.reset();
                utils.createContacts('all').openControlBox();
                utils.openContactsPanel();
            }, converse));

            it("are saved to, and can be retrieved from, browserStorage", $.proxy(function () {
                var new_attrs, old_attrs, attrs, old_roster;
                var num_contacts = this.roster.length;
                new_roster = new this.RosterContacts();
                // Roster items are yet to be fetched from browserStorage
                expect(new_roster.length).toEqual(0);
                new_roster.browserStorage = this.roster.browserStorage;
                new_roster.fetch();
                expect(new_roster.length).toEqual(num_contacts);
                // Check that the roster items retrieved from browserStorage
                // have the same attributes values as the original ones.
                attrs = ['jid', 'fullname', 'subscription', 'ask'];
                for (i=0; i<attrs.length; i++) {
                    new_attrs = _.pluck(_.pluck(new_roster.models, 'attributes'), attrs[i]);
                    old_attrs = _.pluck(_.pluck(this.roster.models, 'attributes'), attrs[i]);
                    // Roster items in storage are not necessarily sorted,
                    // so we have to sort them here to do a proper
                    // comparison
                    expect(_.isEqual(new_attrs.sort(), old_attrs.sort())).toEqual(true);
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
                runs(function () {
                    $tabs.find('li').last().find('a').click(); // Clicks the chatrooms tab
                });
                waits(250);
                runs(function () {
                    expect($contacts.is(':visible')).toBe(false);
                    expect($chatrooms.is(':visible')).toBe(true);
                    expect(cbview.switchTab).toHaveBeenCalled();
                });
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
        }, converse));
    }, converse, mock, test_utils));
}));
