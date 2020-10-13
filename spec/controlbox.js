/*global mock, converse */

const _ = converse.env._;
const $msg = converse.env.$msg;
const u = converse.env.utils;
const Strophe = converse.env.Strophe;
const sizzle = converse.env.sizzle;


describe("The Controlbox", function () {

    it("can be opened by clicking a DOM element with class 'toggle-controlbox'",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            function (done, _converse) {

        // This spec will only pass if the controlbox is not currently
        // open yet.
        let el = document.querySelector("div#controlbox");
        expect(_.isElement(el)).toBe(true);
        expect(u.isVisible(el)).toBe(false);
        spyOn(_converse.controlboxtoggle, 'onClick').and.callThrough();
        spyOn(_converse.controlboxtoggle, 'showControlBox').and.callThrough();
        spyOn(_converse.api, "trigger").and.callThrough();
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


    it("can be closed by clicking a DOM element with class 'close-chatbox-button'",
            mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

        await mock.openControlBox(_converse);
        const controlview = _converse.chatboxviews.get('controlbox');

        spyOn(controlview, 'close').and.callThrough();
        spyOn(_converse.api, "trigger").and.callThrough();

        // We need to rebind all events otherwise our spy won't be called
        controlview.delegateEvents();

        controlview.el.querySelector('.close-chatbox-button').click();
        expect(controlview.close).toHaveBeenCalled();
        await new Promise(resolve => _converse.api.listen.once('chatBoxClosed', resolve));
        expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
        done();
    }));


    describe("The \"Contacts\" section", function () {

        it("can be used to add contact and it checks for case-sensivity",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            spyOn(_converse.api, "trigger").and.callThrough();
            spyOn(_converse.rosterview, 'update').and.callThrough();
            await mock.openControlBox(_converse);
            // Adding two contacts one with Capital initials and one with small initials of same JID (Case sensitive check)
            _converse.roster.create({
                jid: mock.pend_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                subscription: 'none',
                ask: 'subscribe',
                fullname: mock.pend_names[0]
            });
            _converse.roster.create({
                jid: mock.pend_names[0].replace(/ /g,'.') + '@montague.lit',
                subscription: 'none',
                ask: 'subscribe',
                fullname: mock.pend_names[0]
            });
            await u.waitUntil(() => _.filter(_converse.rosterview.el.querySelectorAll('.roster-group li'), u.isVisible).length, 700);
            // Checking that only one entry is created because both JID is same (Case sensitive check)
            expect(_.filter(_converse.rosterview.el.querySelectorAll('li'), u.isVisible).length).toBe(1);
            expect(_converse.rosterview.update).toHaveBeenCalled();
            done();
        }));

        it("shows the number of unread mentions received",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await mock.waitForRoster(_converse, 'all');
            await mock.openControlBox(_converse);

            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, sender_jid);
            await u.waitUntil(() => _converse.chatboxes.length);
            const chatview = _converse.chatboxviews.get(sender_jid);
            chatview.model.set({'minimized': true});

            expect(_converse.chatboxviews.el.querySelector('.restore-chat .message-count') === null).toBeTruthy();
            expect(_converse.rosterview.el.querySelector('.msgs-indicator') === null).toBeTruthy();

            let msg = $msg({
                    from: sender_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: u.getUniqueId()
                }).c('body').t('hello').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            _converse.handleMessageStanza(msg);
            await u.waitUntil(() => _converse.rosterview.el.querySelectorAll(".msgs-indicator").length);
            spyOn(chatview.model, 'handleUnreadMessage').and.callThrough();
            await u.waitUntil(() => _converse.chatboxviews.el.querySelector('.restore-chat .message-count')?.textContent === '1');
            expect(_converse.rosterview.el.querySelector('.msgs-indicator').textContent).toBe('1');

            msg = $msg({
                    from: sender_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: u.getUniqueId()
                }).c('body').t('hello again').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            _converse.handleMessageStanza(msg);
            await u.waitUntil(() => chatview.model.handleUnreadMessage.calls.count());
            await u.waitUntil(() => _converse.chatboxviews.el.querySelector('.restore-chat .message-count')?.textContent === '2');
            expect(_converse.rosterview.el.querySelector('.msgs-indicator').textContent).toBe('2');
            chatview.model.set({'minimized': false});
            expect(_converse.chatboxviews.el.querySelector('.restore-chat .message-count')).toBe(null);
            await u.waitUntil(() => _converse.rosterview.el.querySelector('.msgs-indicator') === null);
            done();
        }));
    });

    describe("The Status Widget", function () {

        it("shows the user's chat status, which is online by default",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                function (done, _converse) {

            mock.openControlBox(_converse);
            var view = _converse.xmppstatusview;
            expect(u.hasClass('online', view.el.querySelector('.xmpp-status span:first-child'))).toBe(true);
            expect(view.el.querySelector('.xmpp-status span.online').textContent.trim()).toBe('I am online');
            done();
        }));

        it("can be used to set the current user's chat status",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await mock.openControlBox(_converse);
            var cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.change-status').click()
            var modal = _converse.xmppstatusview.status_modal;

            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            const view = _converse.xmppstatusview;
            modal.el.querySelector('label[for="radio-busy"]').click(); // Change status to "dnd"
            modal.el.querySelector('[type="submit"]').click();
            const sent_stanzas = _converse.connection.sent_stanzas;
            const sent_presence = await u.waitUntil(() => sent_stanzas.filter(s => Strophe.serialize(s).match('presence')).pop());
            expect(Strophe.serialize(sent_presence)).toBe(
                `<presence xmlns="jabber:client">`+
                    `<show>dnd</show>`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="PxXfr6uz8ClMWIga0OB/MhKNH/M=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`);
            const first_child = view.el.querySelector('.xmpp-status span:first-child');
            expect(u.hasClass('online', first_child)).toBe(false);
            expect(u.hasClass('dnd', first_child)).toBe(true);
            expect(view.el.querySelector('.xmpp-status span:first-child').textContent.trim()).toBe('I am busy');
            done();
        }));

        it("can be used to set a custom status message",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await mock.openControlBox(_converse);
            const cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.change-status').click()
            const modal = _converse.xmppstatusview.status_modal;

            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            const view = _converse.xmppstatusview;
            const msg = 'I am happy';
            modal.el.querySelector('input[name="status_message"]').value = msg;
            modal.el.querySelector('[type="submit"]').click();
            const sent_stanzas = _converse.connection.sent_stanzas;
            const sent_presence = await u.waitUntil(() => sent_stanzas.filter(s => Strophe.serialize(s).match('presence')).pop());
            expect(Strophe.serialize(sent_presence)).toBe(
                `<presence xmlns="jabber:client">`+
                    `<status>I am happy</status>`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="PxXfr6uz8ClMWIga0OB/MhKNH/M=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`);

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
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'all');
        await mock.openControlBox(_converse);

        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.el.querySelector('.add-contact').click()
        const modal = _converse.rosterview.add_contact_modal;
        await u.waitUntil(() => u.isVisible(modal.el), 1000);
        expect(modal.el.querySelector('form.add-xmpp-contact')).not.toBe(null);

        const input_jid = modal.el.querySelector('input[name="jid"]');
        const input_name = modal.el.querySelector('input[name="name"]');
        input_jid.value = 'someone@';

        const evt = new Event('input');
        input_jid.dispatchEvent(evt);
        expect(modal.el.querySelector('.suggestion-box li').textContent).toBe('someone@montague.lit');
        input_jid.value = 'someone@montague.lit';
        input_name.value = 'Someone';
        modal.el.querySelector('button[type="submit"]').click();

        const sent_IQs = _converse.connection.IQ_stanzas;
        const sent_stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`)).pop());
        expect(Strophe.serialize(sent_stanza)).toEqual(
            `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"><item jid="someone@montague.lit" name="Someone"/></query>`+
            `</iq>`);
        done();
    }));

    it("can be configured to not provide search suggestions",
        mock.initConverse(
            ['rosterGroupsFetched'], {'autocomplete_add_contact': false},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'all', 0);
        mock.openControlBox(_converse);
        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.el.querySelector('.add-contact').click()
        const modal = _converse.rosterview.add_contact_modal;
        expect(modal.jid_auto_complete).toBe(undefined);
        expect(modal.name_auto_complete).toBe(undefined);

        await u.waitUntil(() => u.isVisible(modal.el), 1000);
        expect(modal.el.querySelector('form.add-xmpp-contact')).not.toBe(null);
        const input_jid = modal.el.querySelector('input[name="jid"]');
        input_jid.value = 'someone@montague.lit';
        modal.el.querySelector('button[type="submit"]').click();

        const IQ_stanzas = _converse.connection.IQ_stanzas;
        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`, s).length).pop()
        );
        expect(Strophe.serialize(sent_stanza)).toEqual(
            `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                `<query xmlns="jabber:iq:roster"><item jid="someone@montague.lit"/></query>`+
            `</iq>`
        );
        done();
    }));


    it("integrates with xhr_user_search_url to search for contacts",
        mock.initConverse(
            ['rosterGroupsFetched'],
            { 'xhr_user_search_url': 'http://example.org/?' },
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'all', 0);

        const xhr = {
            'open': function open () {},
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

        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.el.querySelector('.add-contact').click()
        const modal = _converse.rosterview.add_contact_modal;
        await u.waitUntil(() => u.isVisible(modal.el), 1000);

        // We only have autocomplete for the name input
        expect(modal.jid_auto_complete).toBe(undefined);
        expect(modal.name_auto_complete instanceof _converse.AutoComplete).toBe(true);

        const input_el = modal.el.querySelector('input[name="name"]');
        input_el.value = 'marty';
        input_el.dispatchEvent(new Event('input'));
        await u.waitUntil(() => modal.el.querySelector('.suggestion-box li'), 1000);
        expect(modal.el.querySelectorAll('.suggestion-box li').length).toBe(1);
        const suggestion = modal.el.querySelector('.suggestion-box li');
        expect(suggestion.textContent).toBe('Marty McFly');

        // Mock selection
        modal.name_auto_complete.select(suggestion);

        expect(input_el.value).toBe('Marty McFly');
        expect(modal.el.querySelector('input[name="jid"]').value).toBe('marty@mcfly.net');
        modal.el.querySelector('button[type="submit"]').click();

        const sent_IQs = _converse.connection.IQ_stanzas;
        const sent_stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`)).pop());
        expect(Strophe.serialize(sent_stanza)).toEqual(
        `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
            `<query xmlns="jabber:iq:roster"><item jid="marty@mcfly.net" name="Marty McFly"/></query>`+
        `</iq>`);
        window.XMLHttpRequest = XMLHttpRequestBackup;
        done();
    }));

    it("can be configured to not provide search suggestions for XHR search results",
        mock.initConverse(
            ['rosterGroupsFetched'],
            { 'autocomplete_add_contact': false,
              'xhr_user_search_url': 'http://example.org/?' },
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'all');
        await mock.openControlBox(_converse);
        var modal;
        const xhr = {
            'open': function open () {},
            'send': function () {
                const value = modal.el.querySelector('input[name="name"]').value;
                if (value === 'existing') {
                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    xhr.responseText = JSON.stringify([{"jid": contact_jid, "fullname": mock.cur_names[0]}]);
                } else if (value === 'romeo') {
                    xhr.responseText = JSON.stringify([{"jid": "romeo@montague.lit", "fullname": "Romeo Montague"}]);
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

        const cbview = _converse.chatboxviews.get('controlbox');
        cbview.el.querySelector('.add-contact').click()
        modal = _converse.rosterview.add_contact_modal;
        await u.waitUntil(() => u.isVisible(modal.el), 1000);

        expect(modal.jid_auto_complete).toBe(undefined);
        expect(modal.name_auto_complete).toBe(undefined);

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

        input_el.value = 'existing';
        modal.el.querySelector('button[type="submit"]').click();
        feedback_el = modal.el.querySelector('.invalid-feedback');
        expect(feedback_el.textContent).toBe('This contact has already been added');

        input_el.value = 'Marty McFly';
        modal.el.querySelector('button[type="submit"]').click();

        const sent_IQs = _converse.connection.IQ_stanzas;
        const sent_stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.ROSTER}"]`)).pop());
        expect(Strophe.serialize(sent_stanza)).toEqual(
        `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
            `<query xmlns="jabber:iq:roster"><item jid="marty@mcfly.net" name="Marty McFly"/></query>`+
        `</iq>`);
        window.XMLHttpRequest = XMLHttpRequestBackup;
        done();
    }));
});
