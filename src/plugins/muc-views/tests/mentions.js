/*global mock, converse */

const { Strophe, $msg, $pres, sizzle } = converse.env;
const u = converse.env.utils;


describe("An incoming groupchat message", function () {

    it("is specially marked when you are mentioned in it",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        if (!view.querySelectorAll('.chat-area').length) { view.renderChatArea(); }
        const message = 'romeo: Your attention is required';
        const nick = mock.chatroom_names[0],
            msg = $msg({
                from: 'lounge@montague.lit/'+nick,
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t(message).tree();
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
        expect(u.hasClass('mentioned', view.querySelector('.chat-msg'))).toBeTruthy();
    }));


    it("highlights all users mentioned via XEP-0372 references",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom');
        const view = _converse.chatboxviews.get(muc_jid);
        ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh'].forEach((nick) => {
            _converse.connection._dataRecv(mock.createRequest(
                $pres({
                    'to': 'tom@montague.lit/resource',
                    'from': `lounge@montague.lit/${nick}`
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': `${nick}@montague.lit/resource`,
                    'role': 'participant'
                }))
            );
        });
        let msg = $msg({
                from: 'lounge@montague.lit/gibson',
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('hello z3r0 tom mr.robot, how are you?').up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'6', 'end':'10', 'type':'mention', 'uri':'xmpp:z3r0@montague.lit'}).up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'11', 'end':'14', 'type':'mention', 'uri':'xmpp:romeo@montague.lit'}).up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'15', 'end':'23', 'type':'mention', 'uri':'xmpp:mr.robot@montague.lit'}).nodeTree;
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelector('.chat-msg__text')?.innerHTML.replace(/<!-.*?->/g, '') ===
            'hello <span class="mention" data-uri="xmpp:z3r0@montague.lit">z3r0</span> '+
            '<span class="mention mention--self badge badge-info" data-uri="xmpp:romeo@montague.lit">tom</span> '+
            '<span class="mention" data-uri="xmpp:mr.robot@montague.lit">mr.robot</span>, how are you?');
        let message = view.querySelector('.chat-msg__text');
        expect(message.classList.length).toEqual(1);

        msg = $msg({
                from: 'lounge@montague.lit/sw0rdf1sh',
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('@gibson').up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'1', 'end':'7', 'type':'mention', 'uri':'xmpp:gibson@montague.lit'}).nodeTree;
        await view.model.handleMessageStanza(msg);

        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);

        message = sizzle('converse-chat-message:last .chat-msg__text', view).pop();
        expect(message.classList.length).toEqual(1);
        expect(message.innerHTML.replace(/<!-.*?->/g, '')).toBe('@<span class="mention" data-uri="xmpp:gibson@montague.lit">gibson</span>');
    }));

    it("properly renders mentions that contain the pipe character",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);
        _converse.connection._dataRecv(mock.createRequest(
            $pres({
                'to': 'romeo@montague.lit/resource',
                'from': `lounge@montague.lit/ThUnD3r|Gr33n`
            })
            .c('x', {xmlns: Strophe.NS.MUC_USER})
            .c('item', {
                'affiliation': 'none',
                'jid': `${nick}@montague.lit/resource`,
                'role': 'participant'
            }))
        );
        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        textarea.value = 'hello @ThUnD3r|Gr33n'
        const enter_event = {
            'target': textarea,
            'preventDefault': function preventDefault () {},
            'stopPropagation': function stopPropagation () {},
            'keyCode': 13 // Enter
        }
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown(enter_event);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
        const sent_stanzas = _converse.connection.sent_stanzas;
        const msg = await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName.toLowerCase() === 'message').pop());
        expect(Strophe.serialize(msg))
            .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.getAttribute("id")}" `+
                    `to="lounge@montague.lit" type="groupchat" `+
                    `xmlns="jabber:client">`+
                        `<body>hello ThUnD3r|Gr33n</body>`+
                        `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                        `<reference begin="6" end="19" type="mention" uri="xmpp:lounge@montague.lit/ThUnD3r%7CGr33n" xmlns="urn:xmpp:reference:0"/>`+
                        `<origin-id id="${msg.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                    `</message>`);

        const message = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(message.innerHTML.replace(/<!-.*?->/g, '')).toBe('hello <span class="mention" data-uri="xmpp:lounge@montague.lit/ThUnD3r%7CGr33n">ThUnD3r|Gr33n</span>');
    }));

    it("highlights all users mentioned via XEP-0372 references in a quoted message",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom');
        const view = _converse.chatboxviews.get(muc_jid);
        ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh'].forEach((nick) => {
            _converse.connection._dataRecv(mock.createRequest(
                $pres({
                    'to': 'tom@montague.lit/resource',
                    'from': `lounge@montague.lit/${nick}`
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': `${nick}@montague.lit/resource`,
                    'role': 'participant'
                }))
            );
        });
        const msg = $msg({
                from: 'lounge@montague.lit/gibson',
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('>hello z3r0 tom mr.robot, how are you?').up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'7', 'end':'11', 'type':'mention', 'uri':'xmpp:z3r0@montague.lit'}).up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'12', 'end':'15', 'type':'mention', 'uri':'xmpp:romeo@montague.lit'}).up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'16', 'end':'24', 'type':'mention', 'uri':'xmpp:mr.robot@montague.lit'}).nodeTree;

        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelector('.chat-msg__text')?.innerHTML.replace(/<!-.*?->/g, '') ===
            '<blockquote>hello <span class="mention" data-uri="xmpp:z3r0@montague.lit">z3r0</span> '+
            '<span class="mention mention--self badge badge-info" data-uri="xmpp:romeo@montague.lit">tom</span> '+
            '<span class="mention" data-uri="xmpp:mr.robot@montague.lit">mr.robot</span>, how are you?</blockquote>');
        const message = view.querySelector('.chat-msg__text');
        expect(message.classList.length).toEqual(1);
    }));
});


describe("A sent groupchat message", function () {

    describe("in which someone is mentioned", function () {

        it("gets parsed for mentions which get turned into references",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';

            // Making the MUC non-anonymous so that real JIDs are included
            const features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                Strophe.NS.SID,
                Strophe.NS.MAM,
                'muc_passwordprotected',
                'muc_hidden',
                'muc_temporary',
                'muc_open',
                'muc_unmoderated',
                'muc_nonanonymous'
            ];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom', features);
            const view = _converse.chatboxviews.get(muc_jid);
            ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh', 'Link Mauve', 'robot'].forEach((nick) => {
                _converse.connection._dataRecv(mock.createRequest(
                    $pres({
                        'to': 'tom@montague.lit/resource',
                        'from': `lounge@montague.lit/${nick}`
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': `${nick.replace(/\s/g, '-')}@montague.lit/resource`,
                        'role': 'participant'
                    })));
            });

            // Also check that nicks from received messages, (but for which we don't have occupant objects) can be mentioned.
            const stanza = u.toStanza(`
                <message xmlns="jabber:client"
                        from="${muc_jid}/gh0st"
                        to="${_converse.connection.bare_jid}"
                        type="groupchat">
                    <body>Boo!</body>
                </message>`);
            await view.model.handleMessageStanza(stanza);

            // Run a few unit tests for the parseTextForReferences method
            let [text, references] = view.model.parseTextForReferences('yo @robot')
            expect(text).toBe('yo robot');
            expect(references)
                .toEqual([{"begin":3,"end":8,"value":"robot","type":"mention","uri":"xmpp:robot@montague.lit"}]);

            [text, references] = view.model.parseTextForReferences('@@gh0st')
            expect(text).toBe('@gh0st');
            expect(references.length).toBe(1);
            expect(references)
                .toEqual([{"begin":1,"end":6,"value":"gh0st","type":"mention","uri":"xmpp:lounge@montague.lit/gh0st"}]);

            [text, references] = view.model.parseTextForReferences('hello z3r0')
            expect(references.length).toBe(0);
            expect(text).toBe('hello z3r0');

            [text, references] = view.model.parseTextForReferences('hello @z3r0')
            expect(references.length).toBe(1);
            expect(text).toBe('hello z3r0');
            expect(references)
                .toEqual([{"begin":6,"end":10,"value":"z3r0","type":"mention","uri":"xmpp:z3r0@montague.lit"}]);

            [text, references] = view.model.parseTextForReferences('hello @some1 @z3r0 @gibson @mr.robot, how are you?')
            expect(text).toBe('hello @some1 z3r0 gibson mr.robot, how are you?');
            expect(references)
                .toEqual([{"begin":13,"end":17,"value":"z3r0","type":"mention","uri":"xmpp:z3r0@montague.lit"},
                        {"begin":18,"end":24,"value":"gibson","type":"mention","uri":"xmpp:gibson@montague.lit"},
                        {"begin":25,"end":33,"value":"mr.robot","type":"mention","uri":"xmpp:mr.robot@montague.lit"}]);

            [text, references] = view.model.parseTextForReferences('yo @gib')
            expect(text).toBe('yo @gib');
            expect(references.length).toBe(0);

            [text, references] = view.model.parseTextForReferences('yo @gibsonian')
            expect(text).toBe('yo @gibsonian');
            expect(references.length).toBe(0);

            [text, references] = view.model.parseTextForReferences('yo @GiBsOn')
            expect(text).toBe('yo gibson');
            expect(references.length).toBe(1);

            [text, references] = view.model.parseTextForReferences('@gibson')
            expect(text).toBe('gibson');
            expect(references.length).toBe(1);
            expect(references)
                .toEqual([{"begin":0,"end":6,"value":"gibson","type":"mention","uri":"xmpp:gibson@montague.lit"}]);

            [text, references] = view.model.parseTextForReferences('hi @Link Mauve how are you?')
            expect(text).toBe('hi Link Mauve how are you?');
            expect(references.length).toBe(1);
            expect(references)
                .toEqual([{"begin":3,"end":13,"value":"Link Mauve","type":"mention","uri":"xmpp:Link-Mauve@montague.lit"}]);

            [text, references] = view.model.parseTextForReferences('https://example.org/@gibson')
            expect(text).toBe('https://example.org/@gibson');
            expect(references.length).toBe(0);
            expect(references).toEqual([]);

            [text, references] = view.model.parseTextForReferences('mail@gibson.com')
            expect(text).toBe('mail@gibson.com');
            expect(references.length).toBe(0);
            expect(references)
                .toEqual([]);

            [text, references] = view.model.parseTextForReferences(
                "Welcome @gibson 💩 We have a guide on how to do that here: https://conversejs.org/docs/html/index.html");
            expect(text).toBe("Welcome gibson 💩 We have a guide on how to do that here: https://conversejs.org/docs/html/index.html");
            expect(references.length).toBe(1);
            expect(references).toEqual([{"begin":8,"end":14,"value":"gibson","type":"mention","uri":"xmpp:gibson@montague.lit"}]);

            [text, references] = view.model.parseTextForReferences(
                'https://linkmauve.fr@Link Mauve/ https://linkmauve.fr/@github/is_back gibson@gibson.com gibson@Link Mauve.fr')
            expect(text).toBe(
                'https://linkmauve.fr@Link Mauve/ https://linkmauve.fr/@github/is_back gibson@gibson.com gibson@Link Mauve.fr');
            expect(references.length).toBe(0);
            expect(references)
                .toEqual([]);

            [text, references] = view.model.parseTextForReferences('@gh0st where are you?')
            expect(text).toBe('gh0st where are you?');
            expect(references.length).toBe(1);
            expect(references)
                .toEqual([{"begin":0,"end":5,"value":"gh0st","type":"mention","uri":"xmpp:lounge@montague.lit/gh0st"}]);
        }));

        it("gets parsed for mentions as indicated with an @ preceded by a space or at the start of the text",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom');
            const view = _converse.chatboxviews.get(muc_jid);
            ['NotAnAdress', 'darnuria'].forEach((nick) => {
                _converse.connection._dataRecv(mock.createRequest(
                    $pres({
                        'to': 'tom@montague.lit/resource',
                        'from': `lounge@montague.lit/${nick}`
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': `${nick.replace(/\s/g, '-')}@montague.lit/resource`,
                        'role': 'participant'
                    })));
            });

            // Test that we don't match @nick in email adresses.
            let [text, references] = view.model.parseTextForReferences('contact contact@NotAnAdress.eu');
            expect(references.length).toBe(0);
            expect(text).toBe('contact contact@NotAnAdress.eu');

            // Test that we don't match @nick in url
            [text, references] = view.model.parseTextForReferences('nice website https://darnuria.eu/@darnuria');
            expect(references.length).toBe(0);
            expect(text).toBe('nice website https://darnuria.eu/@darnuria');
        }));

        it("properly encodes the URIs in sent out references",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom');
            const view = _converse.chatboxviews.get(muc_jid);
            _converse.connection._dataRecv(mock.createRequest(
                $pres({
                    'to': 'tom@montague.lit/resource',
                    'from': `lounge@montague.lit/Link Mauve`
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'role': 'participant'
                })));
            await u.waitUntil(() => view.model.occupants.length === 2);

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = 'hello @Link Mauve'
            const enter_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 13 // Enter
            }
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown(enter_event);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
            const sent_stanzas = _converse.connection.sent_stanzas;
            const msg = await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName.toLowerCase() === 'message').pop());
            expect(Strophe.serialize(msg))
                .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.getAttribute("id")}" `+
                        `to="lounge@montague.lit" type="groupchat" `+
                        `xmlns="jabber:client">`+
                            `<body>hello Link Mauve</body>`+
                            `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                            `<reference begin="6" end="16" type="mention" uri="xmpp:lounge@montague.lit/Link%20Mauve" xmlns="urn:xmpp:reference:0"/>`+
                            `<origin-id id="${msg.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                        `</message>`);
        }));

        it("can get corrected and given new references",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';

            // Making the MUC non-anonymous so that real JIDs are included
            const features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                Strophe.NS.SID,
                Strophe.NS.MAM,
                'muc_passwordprotected',
                'muc_hidden',
                'muc_temporary',
                'muc_open',
                'muc_unmoderated',
                'muc_nonanonymous'
            ];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom', features);
            const view = _converse.chatboxviews.get(muc_jid);
            ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh'].forEach((nick) => {
                _converse.connection._dataRecv(mock.createRequest(
                    $pres({
                        'to': 'tom@montague.lit/resource',
                        'from': `lounge@montague.lit/${nick}`
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': `${nick}@montague.lit/resource`,
                        'role': 'participant'
                    })));
            });
            await u.waitUntil(() => view.model.occupants.length === 5);

            const textarea = await u.waitUntil(() => view.querySelector('textarea.chat-textarea'));
            textarea.value = 'hello @z3r0 @gibson @mr.robot, how are you?'
            const enter_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 13 // Enter
            }
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown(enter_event);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

            const last_msg_sel = 'converse-chat-message:last-child .chat-msg__text';
            await u.waitUntil(() =>
                view.querySelector(last_msg_sel).innerHTML.replace(/<!-.*?->/g, '') ===
                'hello <span class="mention" data-uri="xmpp:z3r0@montague.lit">z3r0</span> '+
                '<span class="mention" data-uri="xmpp:gibson@montague.lit">gibson</span> '+
                '<span class="mention" data-uri="xmpp:mr.robot@montague.lit">mr.robot</span>, how are you?'
            );

            const sent_stanzas = _converse.connection.sent_stanzas;
            const msg = await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName.toLowerCase() === 'message').pop());
            expect(Strophe.serialize(msg))
                .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.getAttribute("id")}" `+
                        `to="lounge@montague.lit" type="groupchat" `+
                        `xmlns="jabber:client">`+
                            `<body>hello z3r0 gibson mr.robot, how are you?</body>`+
                            `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                            `<reference begin="6" end="10" type="mention" uri="xmpp:z3r0@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="11" end="17" type="mention" uri="xmpp:gibson@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="18" end="26" type="mention" uri="xmpp:mr.robot@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<origin-id id="${msg.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                        `</message>`);

            const action = await u.waitUntil(() => view.querySelector('.chat-msg .chat-msg__action'));
            action.style.opacity = 1;
            action.click();

            expect(textarea.value).toBe('hello @z3r0 @gibson @mr.robot, how are you?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            await u.waitUntil(() => u.hasClass('correcting', view.querySelector('.chat-msg')), 500);

            textarea.value = 'hello @z3r0 @gibson @sw0rdf1sh, how are you?';
            message_form.onKeyDown(enter_event);
            await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent ===
                'hello z3r0 gibson sw0rdf1sh, how are you?', 500);

            const correction = sent_stanzas.filter(s => s.nodeName.toLowerCase() === 'message').pop();
            expect(Strophe.serialize(correction))
                .toBe(`<message from="romeo@montague.lit/orchard" id="${correction.getAttribute("id")}" `+
                        `to="lounge@montague.lit" type="groupchat" `+
                        `xmlns="jabber:client">`+
                            `<body>hello z3r0 gibson sw0rdf1sh, how are you?</body>`+
                            `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                            `<reference begin="6" end="10" type="mention" uri="xmpp:z3r0@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="11" end="17" type="mention" uri="xmpp:gibson@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="18" end="27" type="mention" uri="xmpp:sw0rdf1sh@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<replace id="${msg.getAttribute("id")}" xmlns="urn:xmpp:message-correct:0"/>`+
                            `<origin-id id="${correction.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                        `</message>`);
        }));

        it("includes a XEP-0372 references to that person",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh'].forEach((nick) => {
                _converse.connection._dataRecv(mock.createRequest(
                    $pres({
                        'to': 'tom@montague.lit/resource',
                        'from': `lounge@montague.lit/${nick}`
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': `${nick}@montague.lit/resource`,
                        'role': 'participant'
                    })));
            });
            await u.waitUntil(() => view.model.occupants.length === 5);

            spyOn(_converse.connection, 'send');
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = 'hello @z3r0 @gibson @mr.robot, how are you?'
            const enter_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 13 // Enter
            }
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown(enter_event);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

            const msg = _converse.connection.send.calls.all()[0].args[0];
            expect(Strophe.serialize(msg))
                .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.getAttribute("id")}" `+
                        `to="lounge@montague.lit" type="groupchat" `+
                        `xmlns="jabber:client">`+
                            `<body>hello z3r0 gibson mr.robot, how are you?</body>`+
                            `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                            `<reference begin="6" end="10" type="mention" uri="xmpp:${muc_jid}/z3r0" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="11" end="17" type="mention" uri="xmpp:${muc_jid}/gibson" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="18" end="26" type="mention" uri="xmpp:${muc_jid}/mr.robot" xmlns="urn:xmpp:reference:0"/>`+
                            `<origin-id id="${msg.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                        `</message>`);
        }));
    });

    it("highlights all users mentioned via XEP-0372 references in a quoted message",
            mock.initConverse([], {}, async function (_converse) {

        const members = [{'jid': 'gibson@gibson.net', 'nick': 'gibson', 'affiliation': 'member'}];
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom', [], members);
        const view = _converse.chatboxviews.get(muc_jid);
        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        textarea.value = "Welcome @gibson 💩 We have a guide on how to do that here: https://conversejs.org/docs/html/index.html";
        const enter_event = {
            'target': textarea,
            'preventDefault': function preventDefault () {},
            'stopPropagation': function stopPropagation () {},
            'keyCode': 13 // Enter
        }
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown(enter_event);
        const message = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(message.innerHTML.replace(/<!-.*?->/g, '')).toEqual(
            `Welcome <span class="mention" data-uri="xmpp:${muc_jid}/gibson">gibson</span> <span title=":poop:">💩</span> `+
            `We have a guide on how to do that here: `+
            `<a target="_blank" rel="noopener" href="https://conversejs.org/docs/html/index.html">https://conversejs.org/docs/html/index.html</a>`);
    }));
});
