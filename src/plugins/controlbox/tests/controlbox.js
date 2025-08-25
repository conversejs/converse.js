/*global mock, converse */

const $msg = converse.env.$msg;
const u = converse.env.utils;

describe("The Controlbox", function () {

    it("can be opened by clicking a DOM element with class 'toggle-controlbox'",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        spyOn(_converse.api, "trigger").and.callThrough();
        document.querySelector('.toggle-controlbox').click();
        const el = await u.waitUntil(() => document.querySelector("#controlbox"));
        expect(u.isVisible(el)).toBe(true);
    }));


    it("can be closed by clicking a DOM element with class 'close-chatbox-button'",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.openControlBox(_converse);
        const view = _converse.chatboxviews.get('controlbox');

        spyOn(view, 'close').and.callThrough();
        spyOn(_converse.api, "trigger").and.callThrough();

        const button = await u.waitUntil(() => view.querySelector(".controlbox-heading__btn.close"));
        button.click();
        expect(view.close).toHaveBeenCalled();
        expect(_converse.api.trigger).toHaveBeenCalledWith('controlBoxClosed', jasmine.any(Object));
    }));


    describe("The \"Contacts\" section", function () {

        it("shows the number of unread mentions received",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const { minimize, maximize } = converse.env.u;

            await mock.waitForRoster(_converse, 'all');
            await mock.openControlBox(_converse);

            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, sender_jid);
            await u.waitUntil(() => _converse.chatboxes.length);
            const chatview = _converse.chatboxviews.get(sender_jid);
            minimize(chatview.model);

            const el = document.querySelector('converse-app-chat');
            expect(el.querySelector('.restore-chat .message-count') === null).toBeTruthy();
            const rosterview = document.querySelector('converse-roster');
            expect(rosterview.querySelector('.msgs-indicator') === null).toBeTruthy();

            let msg = $msg({
                    from: sender_jid,
                    to: _converse.api.connection.get().jid,
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
                    to: _converse.api.connection.get().jid,
                    type: 'chat',
                    id: u.getUniqueId()
                }).c('body').t('hello again').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            _converse.handleMessageStanza(msg);
            await u.waitUntil(() => chatview.model.handleUnreadMessage.calls.count());
            await u.waitUntil(() => el.querySelector('.restore-chat .message-count')?.textContent === '2');
            expect(rosterview.querySelector('.msgs-indicator').textContent).toBe('2');
            maximize(chatview.model);
            await u.waitUntil(() => el.querySelector('.restore-chat .message-count') === null);
            await u.waitUntil(() => rosterview.querySelector('.msgs-indicator') === null);
        }));
    });
});
