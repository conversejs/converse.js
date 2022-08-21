/*global mock, converse */

const $msg = converse.env.$msg;
const u = converse.env.utils;
const Strophe = converse.env.Strophe;

describe("The Controlbox", function () {

    it("can be opened by clicking a DOM element with class 'toggle-controlbox'",
            mock.initConverse([], {}, async function (_converse) {

        spyOn(_converse.api, "trigger").and.callThrough();
        document.querySelector('.toggle-controlbox').click();
        expect(_converse.api.trigger).toHaveBeenCalledWith('controlBoxOpened', jasmine.any(Object));
        const el = await u.waitUntil(() => document.querySelector("#controlbox"));
        expect(u.isVisible(el)).toBe(true);
    }));


    it("can be closed by clicking a DOM element with class 'close-chatbox-button'",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.openControlBox(_converse);
        const view = _converse.chatboxviews.get('controlbox');

        spyOn(view, 'close').and.callThrough();
        spyOn(_converse.api, "trigger").and.callThrough();

        view.querySelector('.close-chatbox-button').click();
        expect(view.close).toHaveBeenCalled();
        expect(_converse.api.trigger).toHaveBeenCalledWith('controlBoxClosed', jasmine.any(Object));
    }));


    describe("The \"Contacts\" section", function () {

        it("can be used to add contact and it checks for case-sensivity",
                mock.initConverse([], {}, async function (_converse) {

            spyOn(_converse.api, "trigger").and.callThrough();
            await mock.waitForRoster(_converse, 'all', 0);
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
            const rosterview = await u.waitUntil(() => document.querySelector('converse-roster'));
            await u.waitUntil(() => Array.from(rosterview.querySelectorAll('.roster-group li')).filter(u.isVisible).length, 700);
            // Checking that only one entry is created because both JID is same (Case sensitive check)
            expect(Array.from(rosterview.querySelectorAll('li')).filter(u.isVisible).length).toBe(1);
        }));

        it("shows the number of unread mentions received",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'all');
            await mock.openControlBox(_converse);

            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, sender_jid);
            await u.waitUntil(() => _converse.chatboxes.length);
            const chatview = _converse.chatboxviews.get(sender_jid);
            chatview.model.set({'minimized': true});

            const el = document.querySelector('converse-chats');
            expect(el.querySelector('.restore-chat .message-count') === null).toBeTruthy();
            const rosterview = document.querySelector('converse-roster');
            expect(rosterview.querySelector('.msgs-indicator') === null).toBeTruthy();

            let msg = $msg({
                    from: sender_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: u.getUniqueId()
                }).c('body').t('hello').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            _converse.handleMessageStanza(msg);
            await u.waitUntil(() => rosterview.querySelectorAll(".msgs-indicator").length);
            spyOn(chatview.model, 'handleUnreadMessage').and.callThrough();
            await u.waitUntil(() => el.querySelector('.restore-chat .message-count')?.textContent === '1');
            expect(rosterview.querySelector('.msgs-indicator').textContent).toBe('1');

            msg = $msg({
                    from: sender_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: u.getUniqueId()
                }).c('body').t('hello again').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            _converse.handleMessageStanza(msg);
            await u.waitUntil(() => chatview.model.handleUnreadMessage.calls.count());
            await u.waitUntil(() => el.querySelector('.restore-chat .message-count')?.textContent === '2');
            expect(rosterview.querySelector('.msgs-indicator').textContent).toBe('2');
            chatview.model.set({'minimized': false});
            await u.waitUntil(() => el.querySelector('.restore-chat .message-count') === null);
            await u.waitUntil(() => rosterview.querySelector('.msgs-indicator') === null);
        }));
    });

    describe("The Status Widget", function () {

        it("shows the user's chat status, which is online by default",
                mock.initConverse([], {}, async function (_converse) {
            mock.openControlBox(_converse);
            const view = await u.waitUntil(() => document.querySelector('converse-user-profile'));
            expect(u.hasClass('online', view.querySelector('.xmpp-status span:first-child'))).toBe(true);
            expect(view.querySelector('.xmpp-status span.online').textContent.trim()).toBe('I am online');
        }));

        it("can be used to set the current user's chat status",
                mock.initConverse([], {}, async function (_converse) {

            await mock.openControlBox(_converse);
            var cbview = _converse.chatboxviews.get('controlbox');
            cbview.querySelector('.change-status').click()
            const modal = _converse.api.modal.get('converse-chat-status-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);
            modal.querySelector('label[for="radio-busy"]').click(); // Change status to "dnd"
            modal.querySelector('[type="submit"]').click();
            const sent_stanzas = _converse.connection.sent_stanzas;
            const sent_presence = await u.waitUntil(() => sent_stanzas.filter(s => Strophe.serialize(s).match('presence')).pop());
            expect(Strophe.serialize(sent_presence)).toBe(
                `<presence xmlns="jabber:client">`+
                    `<show>dnd</show>`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`);
            const view = await u.waitUntil(() => document.querySelector('converse-user-profile'));
            const first_child = view.querySelector('.xmpp-status span:first-child');
            expect(u.hasClass('online', first_child)).toBe(false);
            expect(u.hasClass('dnd', first_child)).toBe(true);
            expect(view.querySelector('.xmpp-status span:first-child').textContent.trim()).toBe('I am busy');
        }));

        it("can be used to set a custom status message",
                mock.initConverse([], {}, async function (_converse) {

            await mock.openControlBox(_converse);
            const cbview = _converse.chatboxviews.get('controlbox');
            cbview.querySelector('.change-status').click()
            const modal = _converse.api.modal.get('converse-chat-status-modal');

            await u.waitUntil(() => u.isVisible(modal), 1000);
            const msg = 'I am happy';
            modal.querySelector('input[name="status_message"]').value = msg;
            modal.querySelector('[type="submit"]').click();
            const sent_stanzas = _converse.connection.sent_stanzas;
            const sent_presence = await u.waitUntil(() => sent_stanzas.filter(s => Strophe.serialize(s).match('presence')).pop());
            expect(Strophe.serialize(sent_presence)).toBe(
                `<presence xmlns="jabber:client">`+
                    `<status>I am happy</status>`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`);

            const view = await u.waitUntil(() => document.querySelector('converse-user-profile'));
            const first_child = view.querySelector('.xmpp-status span:first-child');
            expect(u.hasClass('online', first_child)).toBe(true);
            expect(view.querySelector('.xmpp-status span:first-child').textContent.trim()).toBe(msg);
        }));
    });
});
