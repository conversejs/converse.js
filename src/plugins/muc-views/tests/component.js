/*global mock, converse */

const u = converse.env.utils;


describe("The <converse-muc> component", function () {

    it("can be rendered as a standalone component",
            mock.initConverse([], {'auto_insert': false}, async function (_converse) {

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
    }));

    it("will update correctly when the jid property changes",
            mock.initConverse([], {'auto_insert': false}, async function (_converse) {

        const { api } = _converse;
        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';


        const muc_creation_promise = api.rooms.open(muc_jid, {nick, 'hidden': true}, false);
        await mock.getRoomFeatures(_converse, muc_jid, []);
        await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
        await muc_creation_promise;
        const model = _converse.chatboxes.get(muc_jid);
        await u.waitUntil(() => (model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
        const affs = api.settings.get('muc_fetch_members');
        const all_affiliations = Array.isArray(affs) ? affs :  (affs ? ['member', 'admin', 'owner'] : []);
        await mock.returnMemberLists(_converse, muc_jid, [], all_affiliations);
        await model.messages.fetched;

        model.sendMessage({'body': 'hello from the lounge!'});

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
        muc_el.querySelector('.box-flyout').setAttribute('style', 'height: 80vh');

        const message = await u.waitUntil(() => muc_el.querySelector('converse-chat-message'));
        expect(message.model.get('body')).toBe('hello from the lounge!');

        _converse.connection.sent_stanzas = [];

        const muc2_jid = 'bar@montague.lit';
        const muc2_creation_promise = api.rooms.open(muc2_jid, {nick, 'hidden': true}, false);
        await mock.getRoomFeatures(_converse, muc2_jid, []);
        await mock.receiveOwnMUCPresence(_converse, muc2_jid, nick);
        await muc2_creation_promise;
        const model2 = _converse.chatboxes.get(muc2_jid);
        await u.waitUntil(() => (model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
        await mock.returnMemberLists(_converse, muc2_jid, [], all_affiliations);
        await model.messages.fetched;

        model2.sendMessage({'body': 'hello from the bar!'});
        muc_el.setAttribute('jid', muc2_jid);

        await u.waitUntil(() => muc_el.querySelector('converse-chat-message-body').textContent.trim() === 'hello from the bar!');
        body.removeChild(span_el);
    }));
});
