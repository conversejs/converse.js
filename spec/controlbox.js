(function (root, factory) {
    define(["jquery", "jasmine", "mock", "converse-core", "test-utils"], factory);
} (this, function ($, jasmine, mock, converse, test_utils) {
    var _ = converse.env._;
    var $pres = converse.env.$pres;
    var $msg = converse.env.$msg;
    var $iq = converse.env.$iq;
    var u = converse.env.utils;


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
            document.querySelector('.toggle-controlbox').click();
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
                expect($(view.el).find('a.choose-xmpp-status').hasClass('online')).toBe(true);
                expect($(view.el).find('a.choose-xmpp-status').attr('data-value')).toBe('I am online');
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
                view.el.querySelector('a.choose-xmpp-status').click();
                expect(view.toggleOptions).toHaveBeenCalled();
                spyOn(view, 'updateStatusUI').and.callThrough();
                view.initialize(); // Rebind events for spy
                $(view.el).find('.dropdown dd ul li a')[1].click(); // Change status to "dnd"
                expect(view.setStatus).toHaveBeenCalled();
                expect(_converse.emit).toHaveBeenCalledWith('statusChanged', 'dnd');
                expect(view.updateStatusUI).toHaveBeenCalled();
                expect($(view.el).find('a.choose-xmpp-status').hasClass('online')).toBe(false);
                expect($(view.el).find('a.choose-xmpp-status').hasClass('dnd')).toBe(true);
                expect($(view.el).find('a.choose-xmpp-status').attr('data-value')).toBe('I am busy');
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
                view.el.querySelector('a.change-xmpp-status-message').click();
                expect(view.renderStatusChangeForm).toHaveBeenCalled();
                var msg = 'I am happy';
                view.el.querySelector('input.custom-xmpp-status').value = msg;
                view.el.querySelector('[type="submit"]').click();
                expect(view.setStatusMessage).toHaveBeenCalled();
                expect(_converse.emit).toHaveBeenCalledWith('statusMessageChanged', msg);
                expect($(view.el).find('a.choose-xmpp-status').hasClass('online')).toBe(true);
                expect($(view.el).find('a.choose-xmpp-status').attr('data-value')).toBe(msg);
                done();
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
            panel.el.querySelector('a.toggle-xmpp-contact-form').click();
            expect(panel.toggleContactForm).toHaveBeenCalled();
            // XXX: Awaiting more tests, close it again for now...
            panel.el.querySelector('a.toggle-xmpp-contact-form').click();
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
                return $(_converse.rosterview.el).find('.roster-group li:visible').length;
            }, 700).then(function () {
                // Checking that only one entry is created because both JID is same (Case sensitive check)
                expect($(_converse.rosterview.el).find('li:visible').length).toBe(1);
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
            var $panels = $(cbview.el).find('.controlbox-panes');
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
            var $tabs = $(cbview.el).find('#controlbox-tabs');
            expect(cbview.model.get('active-panel')).toBe('users');
            $tabs.find('li').last().find('a')[0].click();
            expect(cbview.model.get('active-panel')).toBe('chatrooms');
            $tabs.find('li').first().find('a')[0].click();
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
