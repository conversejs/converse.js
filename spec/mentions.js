/*global mock, converse */

const { Promise, Strophe, $msg, $pres } = converse.env;
const u = converse.env.utils;


describe("An incoming groupchat message", function () {

    it("is specially marked when you are mentioned in it",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.api.chatviews.get(muc_jid);
        if (!view.el.querySelectorAll('.chat-area').length) { view.renderChatArea(); }
        const message = 'romeo: Your attention is required';
        const nick = mock.chatroom_names[0],
            msg = $msg({
                from: 'lounge@montague.lit/'+nick,
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t(message).tree();
        await view.model.handleMessageStanza(msg);
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(u.hasClass('mentioned', view.el.querySelector('.chat-msg'))).toBeTruthy();
        done();
    }));


    it("highlights all users mentioned via XEP-0372 references",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom');
        const view = _converse.api.chatviews.get(muc_jid);
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
            }).c('body').t('hello z3r0 tom mr.robot, how are you?').up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'6', 'end':'10', 'type':'mention', 'uri':'xmpp:z3r0@montague.lit'}).up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'11', 'end':'14', 'type':'mention', 'uri':'xmpp:romeo@montague.lit'}).up()
                .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'15', 'end':'23', 'type':'mention', 'uri':'xmpp:mr.robot@montague.lit'}).nodeTree;
        await view.model.handleMessageStanza(msg);
        const message = await u.waitUntil(() => view.el.querySelector('.chat-msg__text'));
        expect(message.classList.length).toEqual(1);
        expect(message.innerHTML.replace(/<!---->/g, '')).toBe(
            'hello <span class="mention">z3r0</span> '+
            '<span class="mention mention--self badge badge-info">tom</span> '+
            '<span class="mention">mr.robot</span>, how are you?');
        done();
    }));

    it("highlights all users mentioned via XEP-0372 references in a quoted message",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom');
        const view = _converse.api.chatviews.get(muc_jid);
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
        const message = await u.waitUntil(() => view.el.querySelector('.chat-msg__text'));
        expect(message.classList.length).toEqual(1);
        expect(message.innerHTML.replace(/<!---->/g, '')).toBe(
            '<blockquote>hello <span class="mention">z3r0</span> <span class="mention mention--self badge badge-info">tom</span> <span class="mention">mr.robot</span>, how are you?</blockquote>');
        done();
    }));
});


describe("A sent groupchat message", function () {

    describe("in which someone is mentioned", function () {

        it("gets parsed for mentions which get turned into references",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom');
            const view = _converse.api.chatviews.get(muc_jid);
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

            // Also check that nicks from received messages, (but for which
            // we don't have occupant objects) can be mentioned.
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
            expect(references)
                .toEqual([]);

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
            done();
        }));

        it("gets parsed for mentions as indicated with an @ preceded by a space or at the start of the text",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom');
            const view = _converse.api.chatviews.get(muc_jid);
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
            done();
        }));

        it("properly encodes the URIs in sent out references",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom');
            const view = _converse.api.roomviews.get(muc_jid);
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

            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = 'hello @Link Mauve'
            const enter_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 13 // Enter
            }
            spyOn(_converse.connection, 'send');
            view.onKeyDown(enter_event);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            const msg = _converse.connection.send.calls.all()[1].args[0];
            expect(msg.toLocaleString())
                .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.nodeTree.getAttribute("id")}" `+
                        `to="lounge@montague.lit" type="groupchat" `+
                        `xmlns="jabber:client">`+
                            `<body>hello Link Mauve</body>`+
                            `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                            `<reference begin="6" end="16" type="mention" uri="xmpp:lounge@montague.lit/Link%20Mauve" xmlns="urn:xmpp:reference:0"/>`+
                            `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                        `</message>`);
            done();
        }));

        it("can get corrected and given new references",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom');
            const view = _converse.api.chatviews.get(muc_jid);
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

            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = 'hello @z3r0 @gibson @mr.robot, how are you?'
            const enter_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 13 // Enter
            }
            spyOn(_converse.connection, 'send');
            view.onKeyDown(enter_event);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            const last_msg_sel = 'converse-chat-message:last-child .chat-msg__text';
            await u.waitUntil(() =>
                view.content.querySelector(last_msg_sel).innerHTML.replace(/<!---->/g, '') ===
                    'hello <span class="mention">z3r0</span> <span class="mention">gibson</span> <span class="mention">mr.robot</span>, how are you?'
            );

            const msg = _converse.connection.send.calls.all()[1].args[0];
            expect(msg.toLocaleString())
                .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.nodeTree.getAttribute("id")}" `+
                        `to="lounge@montague.lit" type="groupchat" `+
                        `xmlns="jabber:client">`+
                            `<body>hello z3r0 gibson mr.robot, how are you?</body>`+
                            `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                            `<reference begin="6" end="10" type="mention" uri="xmpp:z3r0@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="11" end="17" type="mention" uri="xmpp:gibson@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="18" end="26" type="mention" uri="xmpp:mr.robot@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                        `</message>`);

            const action = await u.waitUntil(() => view.el.querySelector('.chat-msg .chat-msg__action'));
            action.style.opacity = 1;
            action.click();

            expect(textarea.value).toBe('hello @z3r0 @gibson @mr.robot, how are you?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await u.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')), 500);
            await u.waitUntil(() => _converse.connection.send.calls.count() === 2);

            textarea.value = 'hello @z3r0 @gibson @sw0rdf1sh, how are you?';
            view.onKeyDown(enter_event);
            await u.waitUntil(() => view.el.querySelector('.chat-msg__text').textContent ===
                'hello z3r0 gibson sw0rdf1sh, how are you?', 500);

            const correction = _converse.connection.send.calls.all()[2].args[0];
            expect(correction.toLocaleString())
                .toBe(`<message from="romeo@montague.lit/orchard" id="${correction.nodeTree.getAttribute("id")}" `+
                        `to="lounge@montague.lit" type="groupchat" `+
                        `xmlns="jabber:client">`+
                            `<body>hello z3r0 gibson sw0rdf1sh, how are you?</body>`+
                            `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                            `<reference begin="6" end="10" type="mention" uri="xmpp:z3r0@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="11" end="17" type="mention" uri="xmpp:gibson@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="18" end="27" type="mention" uri="xmpp:sw0rdf1sh@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<replace id="${msg.nodeTree.getAttribute("id")}" xmlns="urn:xmpp:message-correct:0"/>`+
                            `<origin-id id="${correction.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                        `</message>`);
            done();
        }));

        it("includes a XEP-0372 references to that person",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
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
            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = 'hello @z3r0 @gibson @mr.robot, how are you?'
            const enter_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 13 // Enter
            }
            view.onKeyDown(enter_event);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            const msg = _converse.connection.send.calls.all()[1].args[0];
            expect(msg.toLocaleString())
                .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.nodeTree.getAttribute("id")}" `+
                        `to="lounge@montague.lit" type="groupchat" `+
                        `xmlns="jabber:client">`+
                            `<body>hello z3r0 gibson mr.robot, how are you?</body>`+
                            `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                            `<reference begin="6" end="10" type="mention" uri="xmpp:z3r0@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="11" end="17" type="mention" uri="xmpp:gibson@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<reference begin="18" end="26" type="mention" uri="xmpp:mr.robot@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                            `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                        `</message>`);
            done();
        }));
    });

    it("highlights all users mentioned via XEP-0372 references in a quoted message",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
                async function (done, _converse) {

        const members = [{'jid': 'gibson@gibson.net', 'nick': 'gibson', 'affiliation': 'member'}];
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'tom', [], members);
        const view = _converse.api.chatviews.get(muc_jid);
        const textarea = view.el.querySelector('textarea.chat-textarea');
        textarea.value = "Welcome @gibson 💩 We have a guide on how to do that here: https://conversejs.org/docs/html/index.html";
        const enter_event = {
            'target': textarea,
            'preventDefault': function preventDefault () {},
            'stopPropagation': function stopPropagation () {},
            'keyCode': 13 // Enter
        }
        view.onKeyDown(enter_event);
        const message = await u.waitUntil(() => view.el.querySelector('.chat-msg__text'));
        expect(message.innerHTML.replace(/<!---->/g, '')).toEqual(
            `Welcome <span class="mention">gibson</span> <span title=":poop:">💩</span> `+
            `We have a guide on how to do that here: `+
            `<a target="_blank" rel="noopener" href="https://conversejs.org/docs/html/index.html">https://conversejs.org/docs/html/index.html</a>`);
        done();
    }));
});
