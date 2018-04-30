(function (root, factory) {
    define(["jquery", "jasmine", "mock", "converse-core", "test-utils"], factory);
} (this, function ($, jasmine, mock, converse, test_utils) {
    var _ = converse.env._;
    var $pres = converse.env.$pres;
    var $msg = converse.env.$msg;
    var $iq = converse.env.$iq;
    var u = converse.env.utils;


    describe("The Controlbox", function () {

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

        describe("The \"Contacts\" section", function () {

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

            it("shows the number of unread mentions received",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'all').openControlBox();

                var contacts_panel = _converse.chatboxviews.get('controlbox').contactspanel;

                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, sender_jid);
                var chatview = _converse.chatboxviews.get(sender_jid);
                chatview.model.set({'minimized': true});

                expect(_.isNull(_converse.chatboxviews.el.querySelector('.restore-chat .message-count'))).toBeTruthy();
                expect(_.isNull(_converse.rosterview.el.querySelector('.msgs-indicator'))).toBeTruthy();

                var msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t('hello').up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                _converse.chatboxes.onMessage(msg);
                expect(_converse.chatboxviews.el.querySelector('.restore-chat .message-count').textContent).toBe('1');
                expect(_converse.rosterview.el.querySelector('.msgs-indicator').textContent).toBe('1');

                msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t('hello again').up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                _converse.chatboxes.onMessage(msg);
                expect(_converse.chatboxviews.el.querySelector('.restore-chat .message-count').textContent).toBe('2');
                expect(_converse.rosterview.el.querySelector('.msgs-indicator').textContent).toBe('2');

                chatview.model.set({'minimized': false});
                expect(_.isNull(_converse.chatboxviews.el.querySelector('.restore-chat .message-count'))).toBeTruthy();
                expect(_.isNull(_converse.rosterview.el.querySelector('.msgs-indicator'))).toBeTruthy();
                done();
            }));
        });

        describe("The Status Widget", function () {

            it("shows the user's chat status, which is online by default",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();
                var view = _converse.xmppstatusview;
                expect($(view.el).find('.xmpp-status span:first-child').hasClass('online')).toBe(true);
                expect(view.el.querySelector('.xmpp-status span.online').textContent.trim()).toBe('I am online');
                done();
            }));

            it("can be used to set the current user's chat status",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();

                var cbview = _converse.chatboxviews.get('controlbox');
                cbview.el.querySelector('.change-status').click()
                var modal = _converse.xmppstatusview.status_modal;

                test_utils.waitUntil(function () {
                    return u.isVisible(modal.el);
                }, 1000).then(function () {
                    var view = _converse.xmppstatusview;
                    spyOn(_converse, 'emit');
                    modal.el.querySelector('label[for="radio-busy"]').click(); // Change status to "dnd"
                    modal.el.querySelector('[type="submit"]').click();

                    expect(_converse.emit).toHaveBeenCalledWith('statusChanged', 'dnd');
                    expect($(view.el).find('.xmpp-status span:first-child').hasClass('online')).toBe(false);
                    expect($(view.el).find('.xmpp-status span:first-child').hasClass('dnd')).toBe(true);
                    expect(view.el.querySelector('.xmpp-status span:first-child').textContent.trim()).toBe('I am busy');
                    done();
                });
            }));

            it("can be used to set a custom status message",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();

                var cbview = _converse.chatboxviews.get('controlbox');
                cbview.el.querySelector('.change-status').click()
                var modal = _converse.xmppstatusview.status_modal;

                test_utils.waitUntil(function () {
                    return u.isVisible(modal.el);
                }, 1000).then(function () {
                    var view = _converse.xmppstatusview;
                    spyOn(_converse, 'emit');

                    var msg = 'I am happy';
                    modal.el.querySelector('input[name="status_message"]').value = msg;
                    modal.el.querySelector('[type="submit"]').click();

                    expect(_converse.emit).toHaveBeenCalledWith('statusMessageChanged', msg);
                    expect($(view.el).find('.xmpp-status span:first-child').hasClass('online')).toBe(true);
                    expect(view.el.querySelector('.xmpp-status span:first-child').textContent.trim()).toBe(msg);
                    done();
                });
            }));
        });
    });

    describe("The 'Add Contact' widget", function () {

        it("opens up an add modal when you click on it",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'all').openControlBox();

            var panel = _converse.chatboxviews.get('controlbox').contactspanel;
            var cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.add-contact').click()
            var modal = _converse.rosterview.add_contact_modal;
            return test_utils.waitUntil(function () {
                return u.isVisible(modal.el);
            }, 1000).then(function () {
                var sendIQ = _converse.connection.sendIQ;
                var sent_stanza, IQ_id;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });

                expect(!_.isNull(modal.el.querySelector('form.add-xmpp-contact'))).toBeTruthy();
                var input_jid = modal.el.querySelector('input[name="jid"]');
                var input_name = modal.el.querySelector('input[name="name"]');
                input_jid.value = 'someone@';
                var evt = new Event('input');
                input_jid.dispatchEvent(evt);
                expect(modal.el.querySelector('.awesomplete li').textContent).toBe('someone@localhost');
                input_jid.value = 'someone@localhost';
                input_name.value = 'Someone';
                modal.el.querySelector('button[type="submit"]').click();
                expect(sent_stanza.toLocaleString()).toEqual(
                "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                    "<query xmlns='jabber:iq:roster'><item jid='someone@localhost' name='Someone'/></query>"+
                "</iq>");
                done();
            });
        }));


        it("integrates with xhr_user_search_url to search for contacts", 
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'],
                { 'xhr_user_search': true,
                  'xhr_user_search_url': 'http://example.org/'
                },
                function (done, _converse) {

            var xhr = {
                'open': _.noop,
                'send': function () {
                    xhr.responseText = JSON.stringify([
                        {"jid": "marty@mcfly.net", "fullname": "Marty McFly"},
                        {"jid": "doc@brown.com", "fullname": "Doc Brown"}
                    ]);
                    xhr.onload();
                }
            };
            const XMLHttpRequestBackup = window.XMLHttpRequest;
            window.XMLHttpRequest = jasmine.createSpy('XMLHttpRequest');
            XMLHttpRequest.and.callFake(function () {
                return xhr;
            });

            var input_el;
            var panel = _converse.chatboxviews.get('controlbox').contactspanel;
            var cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.add-contact').click()
            var modal = _converse.rosterview.add_contact_modal;
            return test_utils.waitUntil(function () {
                return u.isVisible(modal.el);
            }, 1000).then(function () {
                input_el = modal.el.querySelector('input[name="name"]');
                input_el.value = 'marty';
                var evt = new Event('input');
                input_el.dispatchEvent(evt);
                return test_utils.waitUntil(function () {
                    return modal.el.querySelector('.awesomplete li');
                }, 1000);
            }).then(function () {
                var sendIQ = _converse.connection.sendIQ;
                var sent_stanza, IQ_id;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                expect(modal.el.querySelectorAll('.awesomplete li').length).toBe(1);
                const suggestion = modal.el.querySelector('.awesomplete li');
                expect(suggestion.textContent).toBe('Marty McFly');

                // Can't trigger "mousedown" event so trigger the Awesomplete
                // custom event which would have been triggered upon mousedown.
                var evt = document.createEvent("HTMLEvents");
                evt.initEvent('awesomplete-selectcomplete', true, true );
                evt.text = {
                    'label': 'Marty McFly',
                    'value': 'marty@mcfly.net'
                }
                modal.el.dispatchEvent(evt);
                expect(input_el.value).toBe('Marty McFly');
                expect(modal.el.querySelector('input[name="jid"]').value).toBe('marty@mcfly.net');
                modal.el.querySelector('button[type="submit"]').click();
                expect(sent_stanza.toLocaleString()).toEqual(
                "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                    "<query xmlns='jabber:iq:roster'><item jid='marty@mcfly.net' name='Marty McFly'/></query>"+
                "</iq>");
                window.XMLHttpRequest = XMLHttpRequestBackup;
                done();
            });
        }));
    });
}));
