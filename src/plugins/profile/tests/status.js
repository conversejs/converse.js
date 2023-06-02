/*global mock, converse */

const u = converse.env.utils;
const Strophe = converse.env.Strophe;

describe("The Controlbox", function () {
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
            const cbview = _converse.chatboxviews.get('controlbox');
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
