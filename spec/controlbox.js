(function (root, factory) {
    define(["jquery.noconflict", "jasmine", "mock", "converse-core", "test-utils"], factory);
} (this, function ($, jasmine, mock, converse, test_utils) {
    var _ = converse.env._;
    var $pres = converse.env.$pres;
    var $msg = converse.env.$msg;
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

        it("can be opened by clicking a DOM element with class 'toggle-controlbox'",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            // This spec will only pass if the controlbox is not currently
            // open yet.
            expect($("div#controlbox").is(':visible')).toBe(false);
            spyOn(_converse.controlboxtoggle, 'onClick').and.callThrough();
            spyOn(_converse.controlboxtoggle, 'showControlBox').and.callThrough();
            spyOn(_converse, 'emit');
            // Redelegate so that the spies are now registered as the event handlers (specifically for 'onClick')
            _converse.controlboxtoggle.delegateEvents();
            $('.toggle-controlbox').click();
            expect(_converse.controlboxtoggle.onClick).toHaveBeenCalled();
            expect(_converse.controlboxtoggle.showControlBox).toHaveBeenCalled();
            expect(_converse.emit).toHaveBeenCalledWith('controlBoxOpened', jasmine.any(Object));
            expect($("div#controlbox").is(':visible')).toBe(true);
            done();
        }));

        describe("The Status Widget", function () {

            it("shows the user's chat status, which is online by default",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();
                var view = _converse.xmppstatusview;
                expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(true);
                expect(view.$el.find('a.choose-xmpp-status').attr('data-value')).toBe('I am online');
                done();
            }));

            it("can be used to set the current user's chat status",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();
                var view = _converse.xmppstatusview;
                spyOn(view, 'toggleOptions').and.callThrough();
                spyOn(view, 'setStatus').and.callThrough();
                spyOn(_converse, 'emit');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                view.$el.find('a.choose-xmpp-status').click();
                expect(view.toggleOptions).toHaveBeenCalled();
                spyOn(view, 'updateStatusUI').and.callThrough();
                view.initialize(); // Rebind events for spy
                $(view.$el.find('.dropdown dd ul li a')[1]).click(); // Change status to "dnd"
                expect(view.setStatus).toHaveBeenCalled();
                expect(_converse.emit).toHaveBeenCalledWith('statusChanged', 'dnd');
                expect(view.updateStatusUI).toHaveBeenCalled();
                expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(false);
                expect(view.$el.find('a.choose-xmpp-status').hasClass('dnd')).toBe(true);
                expect(view.$el.find('a.choose-xmpp-status').attr('data-value')).toBe('I am busy');
                done();
            }));

            it("can be used to set a custom status message",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();
                var view = _converse.xmppstatusview;
                _converse.xmppstatus.save({'status': 'online'});
                spyOn(view, 'setStatusMessage').and.callThrough();
                spyOn(view, 'renderStatusChangeForm').and.callThrough();
                spyOn(_converse, 'emit');
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                view.$el.find('a.change-xmpp-status-message').click();
                expect(view.renderStatusChangeForm).toHaveBeenCalled();
                var msg = 'I am happy';
                view.$el.find('input.custom-xmpp-status').val(msg);
                view.$el.submit();
                expect(view.setStatusMessage).toHaveBeenCalled();
                expect(_converse.emit).toHaveBeenCalledWith('statusMessageChanged', msg);
                expect(view.$el.find('a.choose-xmpp-status').hasClass('online')).toBe(true);
                expect(view.$el.find('a.choose-xmpp-status').attr('data-value')).toBe(msg);
                done();
            }));
        });
    });

    describe("The Contacts Roster", function () {

        describe("The live filter", function () {

            it("will only appear when roster contacts flow over the visible area",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var $filter = _converse.rosterview.$('.roster-filter');
                var names = mock.cur_names;
                test_utils.openControlBox();
                _converse.rosterview.update(); // XXX: Will normally called as event handler
                expect($filter.length).toBe(1);
                test_utils.waitUntil(function () {
                    return !$filter.is(':visible');
                }).then(function () {
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

                    $.fn.hasScrollBar = function() {
                        if (!$.contains(document, this.get(0))) {
                            return false;
                        }
                        if(this.parent().height() < this.get(0).scrollHeight) {
                            return true;
                        }
                        return false;
                    };

                    return test_utils.waitUntil(function () {
                        if (_converse.rosterview.$roster.hasScrollBar()) {
                            return $filter.is(':visible');
                        } else {
                            return !$filter.is(':visible');
                        }
                    }).then(function () {
                        done();
                    });
                });
            }));

            it("can be used to filter the contacts shown",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var $filter;
                var $roster;
                _converse.roster_groups = true;
                test_utils.openControlBox();
                test_utils.createGroupedContacts(_converse);
                $filter = _converse.rosterview.$('.roster-filter');
                $roster = _converse.rosterview.$roster;
                _converse.rosterview.filter_view.delegateEvents();

                var promise = test_utils.waitUntil(function () {
                        return $roster.find('dd:visible').length === 15;
                    }, 500)
                .then(function (contacts) {
                    expect($roster.find('dt:visible').length).toBe(5);
                    $filter.val("candice");
                    $filter.trigger('keydown');

                    return test_utils.waitUntil(function () {
                        return $roster.find('dd:visible').length === 1;
                    }, 500);
                }).then(function (contacts) {
                    expect($roster.find('dd:visible').eq(0).text().trim()).toBe('Candice van der Knijff');
                    expect($roster.find('dt:visible').length).toBe(1);
                    expect(_.trim($roster.find('dt:visible').eq(0).text())).toBe('colleagues');
                    $filter = _converse.rosterview.$('.roster-filter');
                    $filter.val("an");
                    $filter.trigger('keydown');
                    return test_utils.waitUntil(function () {
                        return $roster.find('dd:visible').length === 5;
                    }, 500)
                }).then(function (contacts) {
                    expect($roster.find('dt:visible').length).toBe(4);
                    $filter = _converse.rosterview.$('.roster-filter');
                    $filter.val("xxx");
                    $filter.trigger('keydown');
                    return test_utils.waitUntil(function () {
                        return $roster.find('dd:visible').length === 0;
                    }, 500)
                }).then(function () {
                    expect($roster.find('dt:visible').length).toBe(0);
                    $filter = _converse.rosterview.$('.roster-filter');
                    $filter.val("");  // Check that contacts are shown again, when the filter string is cleared.
                    $filter.trigger('keydown');
                    return test_utils.waitUntil(function () {
                        return $roster.find('dd:visible').length === 15;
                    }, 500)
                }).then(function () {
                    expect($roster.find('dt:visible').length).toBe(5);
                    _converse.roster_groups = false;
                    done();
                });
            }));

            it("can be used to filter the groups shown",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var $filter;
                var $roster;
                var $type;
                _converse.roster_groups = true;
                test_utils.openControlBox();
                test_utils.createGroupedContacts(_converse);
                _converse.rosterview.filter_view.delegateEvents();
                $filter = _converse.rosterview.$('.roster-filter');
                $roster = _converse.rosterview.$roster;
                $type = _converse.rosterview.$('.filter-type');
                $type.val('groups');
                var promise = test_utils.waitUntil(function () {
                        return $roster.find('dd:visible').length === 15;
                    }, 500); 
                promise.then(function () {
                    expect($roster.find('dt:visible').length).toBe(5);
                    $filter.val("colleagues");
                    $filter.trigger('keydown');
                    return test_utils.waitUntil(function () {
                        return $roster.find('dt:visible').length === 1;
                    }, 500);
                }).then(function () {
                    expect(_.trim($roster.find('dt:visible').eq(0).text())).toBe('colleagues');
                    expect($roster.find('dd:visible').length).toBe(3);
                    // Check that all contacts under the group are shown
                    expect($roster.find('dt:visible').nextUntil('dt', 'dd:hidden').length).toBe(0);
                    $filter = _converse.rosterview.$('.roster-filter');
                    $filter.val("xxx").trigger('keydown');
                    return test_utils.waitUntil(function () {
                        return $roster.find('dd:visible').length === 0;
                    }, 700);
                }).then(function () {
                    expect($roster.find('dt:visible').length).toBe(0);
                    $filter = _converse.rosterview.$('.roster-filter');
                    $filter.val(""); // Check that groups are shown again, when the filter string is cleared.
                    $filter.trigger('keydown');
                    return test_utils.waitUntil(function () {
                        return $roster.find('dd:visible').length === 15;
                    }, 500);
                }).then(function () {
                    expect($roster.find('dt:visible').length).toBe(5);
                    done();
                });
            }));

            it("has a button with which its contents can be cleared",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _converse.roster_groups = true;
                test_utils.openControlBox();
                test_utils.createGroupedContacts(_converse);
                var $filter = _converse.rosterview.$('.roster-filter');
                _converse.rosterview.filter_view.delegateEvents();
                $filter.val("xxx");
                $filter.trigger('keydown');
                expect($filter.hasClass("x")).toBeFalsy();
                $filter = _converse.rosterview.$('.roster-filter');
                test_utils.waitUntil(function () {
                    return _converse.rosterview.$('.roster-filter').hasClass("x");
                }, 900).then(function () {
                    var $filter = _converse.rosterview.$('.roster-filter');
                    $filter.addClass("onX").click();
                    return test_utils.waitUntil(function () {
                        return !_converse.rosterview.$('.roster-filter').hasClass("x");
                    }, 900)
                }).then(function () {
                    expect(document.querySelector('.roster-filter').value).toBe("");
                    done();
                });
            }));

            it("can be used to filter contacts by their chat state",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var $filter;
                var $roster;
                _converse.roster_groups = true;
                test_utils.createGroupedContacts(_converse);
                var jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@localhost';
                _converse.roster.get(jid).set('chat_status', 'online');
                test_utils.openControlBox();

                _converse.rosterview.filter_view.delegateEvents();
                var $type = _converse.rosterview.$('.filter-type');
                $type.val('state').trigger('change');
                $filter = _converse.rosterview.$('.state-type');
                $roster = _converse.rosterview.$roster;

                test_utils.waitUntil(function () {
                        return $roster.find('dd:visible').length === 15;
                    }, 500)
                .then(function () {
                    expect($roster.find('dt:visible').length).toBe(5);
                    $filter.val("online");
                    $filter.trigger('change');
                    return test_utils.waitUntil(function () {
                        return $roster.find('dd:visible').length === 1;
                    }, 500)
                }).then(function () {
                    expect($roster.find('dd:visible').eq(0).text().trim()).toBe('Rinse Sommer');
                    expect($roster.find('dt:visible').length).toBe(1);
                    var $type = _converse.rosterview.$('.filter-type');
                    $type.val('contacts').trigger('change');
                    done();
                });
            }));
        });

        describe("A Roster Group", function () {

            it("can be used to organize existing contacts",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _converse.roster_groups = true;
                spyOn(_converse, 'emit');
                spyOn(_converse.rosterview, 'update').and.callThrough();
                _converse.rosterview.render();
                test_utils.createContacts(_converse, 'pending');
                test_utils.createContacts(_converse, 'requesting');
                test_utils.createGroupedContacts(_converse);
                // Check that the groups appear alphabetically and that
                // requesting and pending contacts are last.
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
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
                    done();
                });
            }));

            it("can share contacts with other roster groups", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _converse.roster_groups = true;
                var groups = ['colleagues', 'friends'];
                spyOn(_converse, 'emit');
                spyOn(_converse.rosterview, 'update').and.callThrough();
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
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dd').length;
                    }, 500)
                .then(function () {
                    // Check that usernames appear alphabetically per group
                    _.each(groups, function (name) {
                        var $contacts = _converse.rosterview.$('dt.roster-group[data-group="'+name+'"]').nextUntil('dt', 'dd');
                        var names = $.map($contacts, function (o) { return $(o).text().trim(); });
                        expect(names).toEqual(_.clone(names).sort());
                        expect(names.length).toEqual(mock.cur_names.length);
                    });
                    done();
                });
            }));

            it("remembers whether it is closed or opened",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

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
                done();
            }));
        });

        describe("Pending Contacts", function () {

            function _addContacts (_converse) {
                // Must be initialized, so that render is called and documentFragment set up.
                test_utils.createContacts(_converse, 'pending').openControlBox().openContactsPanel(_converse);
            }

            it("can be collapsed under their own header", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dd').length;
                    }, 500)
                .then(function () {
                    checkHeaderToggling.apply(_converse, [_converse.rosterview.get('Pending contacts').$el]);
                    done();
                });
            }));

            it("can be added to the roster",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                spyOn(_converse, 'emit');
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
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _converse.show_only_online_users = true;
                spyOn(_converse.rosterview, 'update').and.callThrough();
                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dd').length;
                    }, 500)
                .then(function () {
                    expect(_converse.rosterview.$el.is(':visible')).toEqual(true);
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                    expect(_converse.rosterview.$el.find('dd:visible').length).toBe(3);
                    expect(_converse.rosterview.$el.find('dt:visible').length).toBe(1);
                    done();
                });
            }));

            it("are shown in the roster when hide_offline_users", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _converse.hide_offline_users = true;
                spyOn(_converse.rosterview, 'update').and.callThrough();
                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dd:visible').length;
                    }, 500)
                .then(function () {
                    expect(_converse.rosterview.update).toHaveBeenCalled();
                    expect(_converse.rosterview.$el.is(':visible')).toBe(true);
                    expect(_converse.rosterview.$el.find('dd:visible').length).toBe(3);
                    expect(_converse.rosterview.$el.find('dt:visible').length).toBe(1);
                    done();
                });
            }));

            it("can be removed by the user", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                var name = mock.pend_names[0];
                var jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                var contact = _converse.roster.get(jid);

                spyOn(window, 'confirm').and.returnValue(true);
                spyOn(contact, 'unauthorize').and.callFake(function () { return contact; });
                spyOn(contact, 'removeFromRoster');
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback) {
                    if (typeof callback === "function") { return callback(); }
                });
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')").length;
                    }, 500)
                .then(function () {
                    _converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')")
                        .parent().siblings('.remove-xmpp-contact').click();
                    return test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')").length === 0
                    }, 500)
                }).then(function () {
                    expect(window.confirm).toHaveBeenCalled();
                    expect(_converse.connection.sendIQ).toHaveBeenCalled();
                    expect(contact.removeFromRoster).toHaveBeenCalled();
                    expect(_converse.connection.sendIQ).toHaveBeenCalled();
                    done();
                });
            }));

            it("do not have a header if there aren't any", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();
                var name = mock.pend_names[0];
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
                test_utils.waitUntil(function () {
                        return _converse.rosterview.get('Pending contacts').$el.is(':visible');
                    }, 500)
                .then(function () {
                    _converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')")
                        .parent().siblings('.remove-xmpp-contact').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(_converse.connection.sendIQ).toHaveBeenCalled();
                    expect(_converse.rosterview.get('Pending contacts').$el.is(':visible')).toEqual(false);
                    done();
                });
            }));

            it("is shown when a new private message is received",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                var name;
                spyOn(window, 'confirm').and.returnValue(true);
                for (var i=0; i<mock.pend_names.length; i++) {
                    name = mock.pend_names[i];
                    _converse.rosterview.$el.find(".pending-contact-name:contains('"+name+"')")
                        .parent().siblings('.remove-xmpp-contact').click();
                }
                expect(_converse.rosterview.$el.find('dt#pending-xmpp-contacts').is(':visible')).toBeFalsy();
                done();
            }));

            it("can be added to the roster and they will be sorted alphabetically",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var i, t;
                spyOn(_converse, 'emit');
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
                // Check that they are sorted alphabetically
                t = _.reduce(_converse.rosterview.get('Pending contacts').$el.siblings('dd.pending-xmpp-contact').find('span'), function (result, value) {
                    return result + _.trim(value.textContent);
                }, '');
                expect(t).toEqual(mock.pend_names.slice(0,i+1).sort().join(''));
                done();
            }));
        });

        describe("Existing Contacts", function () {
            var _addContacts = function (_converse) {
                test_utils.createContacts(_converse, 'current').openControlBox().openContactsPanel(_converse);
            };

            it("can be collapsed under their own header", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dd:visible').length;
                    }, 500)
                .then(function () {
                    checkHeaderToggling.apply(_converse, [_converse.rosterview.$el.find('dt.roster-group')]);
                    done();
                });
            }));

            it("will be hidden when appearing under a collapsed group", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _converse.roster_groups = false;
                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dd:visible').length;
                    }, 500)
                .then(function () {
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
                    done();
                });
            }));

            it("can be added to the roster and they will be sorted alphabetically", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

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
                    return _converse.rosterview.$el.find('dd').length;
                }).then(function () {
                    // Check that they are sorted alphabetically
                    var t = _.reduce(_converse.rosterview.$('dt.roster-group').siblings('dd.current-xmpp-contact.offline').find('a.open-chat'), function (result, value) {
                        return result + _.trim(value.textContent);
                    }, '');
                    expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    done();
                });
            }));

            it("can be removed by the user", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dd').length;
                    }, 500)
                .then(function () {
                    var name = mock.cur_names[0];
                    var jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var contact = _converse.roster.get(jid);
                    spyOn(window, 'confirm').and.returnValue(true);
                    spyOn(contact, 'removeFromRoster');
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback) {
                        if (typeof callback === "function") { return callback(); }
                    });
                    _converse.rosterview.$el.find(".open-chat:contains('"+name+"')")
                        .parent().find('.remove-xmpp-contact').click();

                    expect(window.confirm).toHaveBeenCalled();
                    expect(_converse.connection.sendIQ).toHaveBeenCalled();
                    expect(contact.removeFromRoster).toHaveBeenCalled();
                    expect(_converse.rosterview.$el.find(".open-chat:contains('"+name+"')").length).toEqual(0);
                    done();
                });
            }));

            it("do not have a header if there aren't any", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var name = mock.cur_names[0];
                var contact;
                contact = _converse.roster.create({
                    jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'both',
                    ask: null,
                    fullname: name
                });
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
                    spyOn(window, 'confirm').and.returnValue(true);
                    spyOn(contact, 'removeFromRoster');
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback) {
                        if (typeof callback === "function") { return callback(); }
                    });

                    expect(_converse.rosterview.$el.find('dt.roster-group').css('display')).toEqual('block');
                    _converse.rosterview.$el.find(".open-chat:contains('"+name+"')")
                        .parent().find('.remove-xmpp-contact').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(_converse.connection.sendIQ).toHaveBeenCalled();
                    expect(contact.removeFromRoster).toHaveBeenCalled();
                    expect(_converse.rosterview.$el.find('dt.roster-group').css('display')).toEqual('none');
                    done();
                });
            }));

            it("can change their status to online and be sorted alphabetically", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
                    var jid, t;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').and.callThrough();
                    var $roster = _converse.rosterview.$el;
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'online');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _.reduce($roster.find('dt.roster-group').siblings('dd.current-xmpp-contact.online').find('a.open-chat'), function (result, value) {
                            return result + _.trim(value.textContent);
                        }, '');
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                    done();
                });
            }));

            it("can change their status to busy and be sorted alphabetically", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
                    var jid, t;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').and.callThrough();
                    var $roster = _converse.rosterview.$el;
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'dnd');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _.reduce($roster.find('dt.roster-group').siblings('dd.current-xmpp-contact.dnd').find('a.open-chat'), function (result, value) {
                            return result + _.trim(value.textContent);
                        }, '');
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                    done();
                });
            }));

            it("can change their status to away and be sorted alphabetically", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
                    var jid, t;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').and.callThrough();
                    var $roster = _converse.rosterview.$el;
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'away');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _.reduce($roster.find('dt.roster-group').siblings('dd.current-xmpp-contact.away').find('a.open-chat'), function (result, value) {
                            return result + _.trim(value.textContent);
                        }, '');
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                    done();
                });
            }));

            it("can change their status to xa and be sorted alphabetically", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
                    var jid, t;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').and.callThrough();
                    var $roster = _converse.rosterview.$el;
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'xa');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _.reduce($roster.find('dt.roster-group').siblings('dd.current-xmpp-contact.xa').find('a.open-chat'), function (result, value) {
                            return result + _.trim(value.textContent);
                        }, '');
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                    done();
                });
            }));

            it("can change their status to unavailable and be sorted alphabetically", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
                    var jid, t;
                    spyOn(_converse, 'emit');
                    spyOn(_converse.rosterview, 'update').and.callThrough();
                    var $roster = _converse.rosterview.$el;
                    for (var i=0; i<mock.cur_names.length; i++) {
                        jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                        _converse.roster.get(jid).set('chat_status', 'unavailable');
                        expect(_converse.rosterview.update).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = _.reduce($roster.find('dt.roster-group').siblings('dd.current-xmpp-contact.unavailable').find('a.open-chat'), function (result, value) {
                            return result + _.trim(value.textContent);
                        }, '');
                        expect(t).toEqual(mock.cur_names.slice(0,i+1).sort().join(''));
                    }
                    done();
                });
            }));

            it("are ordered according to status: online, busy, away, xa, unavailable, offline", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                _addContacts(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
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
                    done();
                });
            }));
        });

        describe("Requesting Contacts", function () {

            it("can be added to the roster and they will be sorted alphabetically",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                var i, children;
                var names = [];
                var addName = function (idx, item) {
                    if (!$(item).hasClass('request-actions')) {
                        names.push($(item).text().replace(/^\s+|\s+$/g, ''));
                    }
                };
                test_utils.openContactsPanel(_converse);
                spyOn(_converse, 'emit');
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
                expect(_converse.rosterview.update).toHaveBeenCalled();
                // Check that they are sorted alphabetically
                children = _converse.rosterview.get('Contact requests').$el.siblings('dd.requesting-xmpp-contact').find('span');
                names = [];
                children.each(addName);
                expect(names.join('')).toEqual(mock.req_names.slice(0,mock.req_names.length+1).sort().join(''));
                done();
            }));

            it("do not have a header if there aren't any", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openContactsPanel(_converse);
                var name = mock.req_names[0];
                spyOn(window, 'confirm').and.returnValue(true);
                _converse.roster.create({
                    jid: name.replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    fullname: name
                });
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
                    expect(_converse.rosterview.get('Contact requests').$el.is(':visible')).toEqual(true);
                    _converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                        .parent().siblings('.request-actions')
                        .find('.decline-xmpp-request').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(_converse.rosterview.get('Contact requests').$el.is(':visible')).toEqual(false);
                    done();
                });
            }));

            it("can be collapsed under their own header", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'requesting').openControlBox();
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
                    checkHeaderToggling.apply(_converse, [_converse.rosterview.get('Contact requests').$el]);
                    done();
                });
            }));

            it("can have their requests accepted by the user", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'requesting').openControlBox();
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
                    // TODO: Testing can be more thorough here, the user is
                    // actually not accepted/authorized because of
                    // mock_connection.
                    var name = mock.req_names.sort()[0];
                    var jid =  name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var contact = _converse.roster.get(jid);
                    spyOn(_converse.roster, 'sendContactAddIQ').and.callFake(function (jid, fullname, groups, callback) {
                        callback();
                    });
                    spyOn(contact, 'authorize').and.callFake(function () { return contact; });
                    _converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                        .parent().siblings('.request-actions')
                        .find('.accept-xmpp-request').click();
                    expect(_converse.roster.sendContactAddIQ).toHaveBeenCalled();
                    expect(contact.authorize).toHaveBeenCalled();
                    done();
                });
            }));

            it("can have their requests denied by the user", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'requesting').openControlBox();
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
                    _converse.rosterview.update(); // XXX: Hack to make sure $roster element is attaced.
                    var name = mock.req_names.sort()[1];
                    var jid =  name.replace(/ /g,'.').toLowerCase() + '@localhost';
                    var contact = _converse.roster.get(jid);
                    spyOn(window, 'confirm').and.returnValue(true);
                    spyOn(contact, 'unauthorize').and.callFake(function () { return contact; });
                    _converse.rosterview.$el.find(".req-contact-name:contains('"+name+"')")
                        .parent().siblings('.request-actions')
                        .find('.decline-xmpp-request').click();
                    expect(window.confirm).toHaveBeenCalled();
                    expect(contact.unauthorize).toHaveBeenCalled();
                    // There should now be one less contact
                    expect(_converse.roster.length).toEqual(mock.req_names.length-1);
                    done();
                });
            }));

            it("are persisted even if other contacts' change their presence ", mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {}, function (done, _converse) {

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
                done();
            }));
        });

        describe("All Contacts", function () {

            it("are saved to, and can be retrieved from browserStorage",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

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
                done();
            }));

            it("will show fullname and jid properties on tooltip", 
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'all').openControlBox();
                test_utils.openContactsPanel(_converse);
                test_utils.waitUntil(function () {
                        return _converse.rosterview.$el.find('dt').length;
                    }, 500)
                .then(function () {
                    var jid, name, i;
                    for (i=0; i<mock.cur_names.length; i++) {
                        name = mock.cur_names[i];
                        jid = name.replace(/ /g,'.').toLowerCase() + '@localhost';
                        var $dd = _converse.rosterview.$el.find("dd:contains('"+name+"')").children().first();
                        var dd_text = $dd.text();
                        var dd_title = $dd.attr('title');
                        expect(_.trim(dd_text)).toBe(name);
                        expect(dd_title).toContain(name);
                        expect(dd_title).toContain(jid);
                    }
                    done();
                });
            }));
        });
    });

    describe("The 'Add Contact' widget", function () {

        it("opens up an add form when you click on it",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            var panel = _converse.chatboxviews.get('controlbox').contactspanel;
            spyOn(panel, 'toggleContactForm').and.callThrough();
            panel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
            panel.$el.find('a.toggle-xmpp-contact-form').click();
            expect(panel.toggleContactForm).toHaveBeenCalled();
            // XXX: Awaiting more tests, close it again for now...
            panel.$el.find('a.toggle-xmpp-contact-form').click();
            done();
        }));

        it("can be used to add contact and it checks for case-sensivity", 
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            spyOn(_converse, 'emit');
            spyOn(_converse.rosterview, 'update').and.callThrough();
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
            test_utils.waitUntil(function () {
                    return _converse.rosterview.$el.find('dt').length;
                }, 500)
            .then(function () {
                // Checking that only one entry is created because both JID is same (Case sensitive check)
                expect(_converse.rosterview.$el.find('dd:visible').length).toBe(1);
                expect(_converse.rosterview.update).toHaveBeenCalled();
                done();
            });
        }));
    });

    describe("The Controlbox Tabs", function () {

        it("contains two tabs, 'Contacts' and 'ChatRooms'",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.openControlBox();
            var cbview = _converse.chatboxviews.get('controlbox');
            var $panels = cbview.$el.find('.controlbox-panes');
            expect($panels.children().length).toBe(2);
            expect($panels.children().first().attr('id')).toBe('users');
            expect($panels.children().first().is(':visible')).toBe(true);
            expect($panels.children().last().attr('id')).toBe('chatrooms');
            expect($panels.children().last().is(':visible')).toBe(false);
            done();
        }));

        it("remembers which tab was open last",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.openControlBox();
            var cbview = _converse.chatboxviews.get('controlbox');
            var $tabs = cbview.$el.find('#controlbox-tabs');
            expect(cbview.model.get('active-panel')).toBe('users');
            $tabs.find('li').last().find('a').click();
            expect(cbview.model.get('active-panel')).toBe('chatrooms');
            $tabs.find('li').first().find('a').click();
            expect(cbview.model.get('active-panel')).toBe('users');
            done();
        }));

        describe("The \"Contacts\" Panel", function () {

            it("shows the number of unread mentions received",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'all').openControlBox();
                test_utils.openContactsPanel(_converse);

                var contacts_panel = _converse.chatboxviews.get('controlbox').contactspanel;
                expect(_.isNull(contacts_panel.tab_el.querySelector('.msgs-indicator'))).toBeTruthy();

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, sender_jid);
                var chatview = _converse.chatboxviews.get(sender_jid);
                chatview.model.set({'minimized': true});

                var msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t('hello').up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                _converse.chatboxes.onMessage(msg);
                expect(contacts_panel.tab_el.querySelector('.msgs-indicator').textContent).toBe('1');

                msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t('hello again').up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                _converse.chatboxes.onMessage(msg);
                expect(contacts_panel.tab_el.querySelector('.msgs-indicator').textContent).toBe('2');

                var roomspanel = _converse.chatboxviews.get('controlbox').roomspanel;
                expect(_.isNull(roomspanel.tab_el.querySelector('.msgs-indicator'))).toBeTruthy();

                chatview.model.set({'minimized': false});
                expect(_.includes(contacts_panel.tab_el.firstChild.classList, 'unread-msgs')).toBeFalsy();
                expect(_.isNull(contacts_panel.tab_el.querySelector('.msgs-indicator'))).toBeTruthy();
                done();
            }));
        });
    });
}));
