(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    const _ = converse.env._,
          $pres = converse.env.$pres,
          $msg = converse.env.$msg,
          $iq = converse.env.$iq,
          u = converse.env.utils,
          Strophe = converse.env.Strophe;


    describe("The Controlbox", function () {

        it("can be opened by clicking a DOM element with class 'toggle-controlbox'",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            // This spec will only pass if the controlbox is not currently
            // open yet.
            let el = document.querySelector("div#controlbox");
            expect(_.isElement(el)).toBe(true);
            expect(u.isVisible(el)).toBe(false);
            spyOn(_converse.controlboxtoggle, 'onClick').and.callThrough();
            spyOn(_converse.controlboxtoggle, 'showControlBox').and.callThrough();
            spyOn(_converse.api, "trigger");
            // Redelegate so that the spies are now registered as the event handlers (specifically for 'onClick')
            _converse.controlboxtoggle.delegateEvents();
            document.querySelector('.toggle-controlbox').click();
            expect(_converse.controlboxtoggle.onClick).toHaveBeenCalled();
            expect(_converse.controlboxtoggle.showControlBox).toHaveBeenCalled();
            expect(_converse.api.trigger).toHaveBeenCalledWith('controlBoxOpened', jasmine.any(Object));
            el = document.querySelector("div#controlbox");
            expect(u.isVisible(el)).toBe(true);
            done();
        }));

        describe("The \"Contacts\" section", function () {

            it("can be used to add contact and it checks for case-sensivity", 
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                spyOn(_converse.api, "trigger");
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
                await test_utils.waitUntil(() => _.filter(_converse.rosterview.el.querySelectorAll('.roster-group li'), u.isVisible).length, 700);
                // Checking that only one entry is created because both JID is same (Case sensitive check)
                expect(_.filter(_converse.rosterview.el.querySelectorAll('li'), u.isVisible).length).toBe(1);
                expect(_converse.rosterview.update).toHaveBeenCalled();
                done();
            }));

            it("shows the number of unread mentions received",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                test_utils.createContacts(_converse, 'all').openControlBox();
                _converse.api.trigger('rosterContactsFetched');

                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                await test_utils.openChatBoxFor(_converse, sender_jid);
                await test_utils.waitUntil(() => _converse.chatboxes.length);
                const chatview = _converse.chatboxviews.get(sender_jid);
                chatview.model.set({'minimized': true});

                expect(_.isNull(_converse.chatboxviews.el.querySelector('.restore-chat .message-count'))).toBeTruthy();
                expect(_.isNull(_converse.rosterview.el.querySelector('.msgs-indicator'))).toBeTruthy();

                let msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t('hello').up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                _converse.chatboxes.onMessage(msg);
                await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll(".msgs-indicator").length);
                spyOn(chatview.model, 'incrementUnreadMsgCounter').and.callThrough();
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
                await test_utils.waitUntil(() => chatview.model.incrementUnreadMsgCounter.calls.count());
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
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.openControlBox();
                var view = _converse.xmppstatusview;
                expect(u.hasClass('online', view.el.querySelector('.xmpp-status span:first-child'))).toBe(true);
                expect(view.el.querySelector('.xmpp-status span.online').textContent.trim()).toBe('I am online');
                done();
            }));

            it("can be used to set the current user's chat status",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.openControlBox();

                var cbview = _converse.chatboxviews.get('controlbox');
                cbview.el.querySelector('.change-status').click()
                var modal = _converse.xmppstatusview.status_modal;

                await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
                const view = _converse.xmppstatusview;
                spyOn(_converse.api, "trigger");
                modal.el.querySelector('label[for="radio-busy"]').click(); // Change status to "dnd"
                modal.el.querySelector('[type="submit"]').click();

                expect(_converse.api.trigger).toHaveBeenCalledWith('statusChanged', 'dnd');
                const first_child = view.el.querySelector('.xmpp-status span:first-child');
                expect(u.hasClass('online', first_child)).toBe(false);
                expect(u.hasClass('dnd', first_child)).toBe(true);
                expect(view.el.querySelector('.xmpp-status span:first-child').textContent.trim()).toBe('I am busy');
                done();
            }));

            it("can be used to set a custom status message",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.openControlBox();

                const cbview = _converse.chatboxviews.get('controlbox');
                cbview.el.querySelector('.change-status').click()
                const modal = _converse.xmppstatusview.status_modal;

                await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
                const view = _converse.xmppstatusview;
                spyOn(_converse.api, "trigger");

                const msg = 'I am happy';
                modal.el.querySelector('input[name="status_message"]').value = msg;
                modal.el.querySelector('[type="submit"]').click();

                expect(_converse.api.trigger).toHaveBeenCalledWith('statusMessageChanged', msg);
                const first_child = view.el.querySelector('.xmpp-status span:first-child');
                expect(u.hasClass('online', first_child)).toBe(true);
                expect(view.el.querySelector('.xmpp-status span:first-child').textContent.trim()).toBe(msg);
                done();
            }));
        });
    });

    describe("The 'Add Contact' widget", function () {

        it("opens up an add modal when you click on it",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'all').openControlBox();

            const panel = _converse.chatboxviews.get('controlbox').contactspanel;
            const cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.add-contact').click()
            const modal = _converse.rosterview.add_contact_modal;
            await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
            const sendIQ = _converse.connection.sendIQ;
            let sent_stanza, IQ_id;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });

            expect(!_.isNull(modal.el.querySelector('form.add-xmpp-contact'))).toBeTruthy();
            const input_jid = modal.el.querySelector('input[name="jid"]');
            const input_name = modal.el.querySelector('input[name="name"]');
            input_jid.value = 'someone@';
            const evt = new Event('input');
            input_jid.dispatchEvent(evt);
            expect(modal.el.querySelector('.suggestion-box li').textContent).toBe('someone@localhost');
            input_jid.value = 'someone@localhost';
            input_name.value = 'Someone';
            modal.el.querySelector('button[type="submit"]').click();
            expect(sent_stanza.toLocaleString()).toEqual(
            `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"><item jid="someone@localhost" name="Someone"/></query>`+
            `</iq>`);
            done();
        }));

        it("can be configured to not provide search suggestions",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {'autocomplete_add_contact': false},
                async function (done, _converse) {

            test_utils.openControlBox();
            const panel = _converse.chatboxviews.get('controlbox').contactspanel;
            const cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.add-contact').click()
            const modal = _converse.rosterview.add_contact_modal;
            expect(modal.jid_auto_complete).toBe(undefined);
            expect(modal.name_auto_complete).toBe(undefined);

            await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
            const sendIQ = _converse.connection.sendIQ;
            let sent_stanza;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                sendIQ.bind(this)(iq, callback, errback);
            });
            expect(!_.isNull(modal.el.querySelector('form.add-xmpp-contact'))).toBeTruthy();
            const input_jid = modal.el.querySelector('input[name="jid"]');
            const input_name = modal.el.querySelector('input[name="name"]');
            input_jid.value = 'someone@localhost';
            modal.el.querySelector('button[type="submit"]').click();
            await test_utils.waitUntil(() => sent_stanza.nodeTree.matches('iq'));
            expect(sent_stanza.toLocaleString()).toEqual(
            `<iq id="${sent_stanza.nodeTree.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"><item jid="someone@localhost"/></query>`+
            `</iq>`);
            done();
        }));


        it("integrates with xhr_user_search_url to search for contacts", 
            mock.initConverse(
                null, ['rosterGroupsFetched'],
                { 'xhr_user_search_url': 'http://example.org/?' },
                async function (done, _converse) {

            const xhr = {
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
            XMLHttpRequest.and.callFake(() => xhr);

            const panel = _converse.chatboxviews.get('controlbox').contactspanel;
            const cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.add-contact').click()
            const modal = _converse.rosterview.add_contact_modal;
            await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);

            // We only have autocomplete for the name input
            expect(modal.jid_auto_complete).toBe(undefined);
            expect(modal.name_auto_complete instanceof _converse.AutoComplete).toBe(true);

            const input_el = modal.el.querySelector('input[name="name"]');
            input_el.value = 'marty';
            input_el.dispatchEvent(new Event('input'));
            await test_utils.waitUntil(() => modal.el.querySelector('.suggestion-box li'), 1000);
            const sendIQ = _converse.connection.sendIQ;
            let sent_stanza, IQ_id;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            expect(modal.el.querySelectorAll('.suggestion-box li').length).toBe(1);
            const suggestion = modal.el.querySelector('.suggestion-box li');
            expect(suggestion.textContent).toBe('Marty McFly');

            // Mock selection
            modal.name_auto_complete.select(suggestion);

            expect(input_el.value).toBe('Marty McFly');
            expect(modal.el.querySelector('input[name="jid"]').value).toBe('marty@mcfly.net');
            modal.el.querySelector('button[type="submit"]').click();
            expect(sent_stanza.toLocaleString()).toEqual(
            `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"><item jid="marty@mcfly.net" name="Marty McFly"/></query>`+
            `</iq>`);
            window.XMLHttpRequest = XMLHttpRequestBackup;
            done();
        }));

        it("can be configured to not provide search suggestions for XHR search results",
            mock.initConverse(
                null, ['rosterGroupsFetched'],
                { 'autocomplete_add_contact': false,
                  'xhr_user_search_url': 'http://example.org/?' },
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'all').openControlBox();
            var modal;
            const xhr = {
                'open': _.noop,
                'send': function () {
                    const value = modal.el.querySelector('input[name="name"]').value;
                    if (value === 'existing') {
                        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                        xhr.responseText = JSON.stringify([{"jid": contact_jid, "fullname": mock.cur_names[0]}]);
                    } else if (value === 'dummy') {
                        xhr.responseText = JSON.stringify([{"jid": "dummy@localhost", "fullname": "Max Mustermann"}]);
                    } else if (value === 'ambiguous') {
                        xhr.responseText = JSON.stringify([
                            {"jid": "marty@mcfly.net", "fullname": "Marty McFly"},
                            {"jid": "doc@brown.com", "fullname": "Doc Brown"}
                        ]);
                    } else if (value === 'insufficient') {
                        xhr.responseText = JSON.stringify([]);
                    } else {
                        xhr.responseText = JSON.stringify([{"jid": "marty@mcfly.net", "fullname": "Marty McFly"}]);
                    }
                    xhr.onload();
                }
            };
            const XMLHttpRequestBackup = window.XMLHttpRequest;
            window.XMLHttpRequest = jasmine.createSpy('XMLHttpRequest');
            XMLHttpRequest.and.callFake(() => xhr);

            const panel = _converse.chatboxviews.get('controlbox').contactspanel;
            const cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.add-contact').click()
            modal = _converse.rosterview.add_contact_modal;
            await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);

            expect(modal.jid_auto_complete).toBe(undefined);
            expect(modal.name_auto_complete).toBe(undefined);

            const sendIQ = _converse.connection.sendIQ;
            let sent_stanza, IQ_id;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });

            const input_el = modal.el.querySelector('input[name="name"]');
            input_el.value = 'ambiguous';
            modal.el.querySelector('button[type="submit"]').click();
            let feedback_el = modal.el.querySelector('.invalid-feedback');
            expect(feedback_el.textContent).toBe('Sorry, could not find a contact with that name');
            feedback_el.textContent = '';

            input_el.value = 'insufficient';
            modal.el.querySelector('button[type="submit"]').click();
            feedback_el = modal.el.querySelector('.invalid-feedback');
            expect(feedback_el.textContent).toBe('Sorry, could not find a contact with that name');
            feedback_el.textContent = '';

            input_el.value = 'dummy';
            modal.el.querySelector('button[type="submit"]').click();
            feedback_el = modal.el.querySelector('.invalid-feedback');
            expect(feedback_el.textContent).toBe('You cannot add yourself as a contact');

            input_el.value = 'existing';
            modal.el.querySelector('button[type="submit"]').click();
            feedback_el = modal.el.querySelector('.invalid-feedback');
            expect(feedback_el.textContent).toBe('This contact has already been added');

            input_el.value = 'Marty McFly';
            modal.el.querySelector('button[type="submit"]').click();
            expect(sent_stanza.toLocaleString()).toEqual(
            `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"><item jid="marty@mcfly.net" name="Marty McFly"/></query>`+
            `</iq>`);
            window.XMLHttpRequest = XMLHttpRequestBackup;
            done();
        }));
    });
}));
