/*global mock, converse */

const { u, $msg } = converse.env;

describe("A outgoing groupchat Message", function () {

    it("can be styled with span XEP-0393 message styling hints that contain mentions",
        mock.initConverse(['chatBoxesFetched'], {},
            async function (done, _converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.api.chatviews.get(muc_jid);
        const msg_text = "This *message mentions romeo*";
        const msg = $msg({
                from: 'lounge@montague.lit/gibson',
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t(msg_text).up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'23', 'end':'29', 'type':'mention', 'uri':'xmpp:romeo@montague.lit'}).nodeTree;
        await view.model.handleMessageStanza(msg);
        const message = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(message.classList.length).toEqual(1);

        const msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerText).toBe(msg_text);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!---->/g, '') ===
            'This <span class="styling-directive">*</span><b>message mentions <span class="mention mention--self badge badge-info">romeo</span></b><span class="styling-directive">*</span>');
        done();
    }));
});
