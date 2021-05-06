/*global mock, converse */

const u = converse.env.utils;


describe("The <converse-muc> component", function () {

    it("can be rendered as a standalone component",
            mock.initConverse([], {'auto_insert': false}, async function (done, _converse) {

        const { api } = _converse;
        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        const muc_creation_promise = await api.rooms.open(muc_jid, {nick, 'hidden': true}, false);
        await mock.getRoomFeatures(_converse, muc_jid, []);
        await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
        await muc_creation_promise;
        const model = _converse.chatboxes.get(muc_jid);
        await u.waitUntil(() => (model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));

        const span_el = document.createElement('span');
        span_el.classList.add('conversejs');
        span_el.classList.add('converse-embedded');

        const muc_el = document.createElement('converse-muc');
        muc_el.classList.add('chatbox');
        muc_el.classList.add('chatroom');
        muc_el.setAttribute('jid', muc_jid);
        span_el.appendChild(muc_el);

        const body = document.querySelector('body');
        body.appendChild(span_el);
        await u.waitUntil(() => muc_el.querySelector('converse-muc-bottom-panel'));
        body.removeChild(span_el);
        expect(true).toBe(true);
        done();
    }));
});
