/*global mock, converse */

const { u, $msg } = converse.env;

describe("An incoming chat Message", function () {

    it("can have styling disabled via an \"unstyled\" element",
        mock.initConverse(['chatBoxesFetched'], {},
            async function (_converse) {

        const include_nick = false;
        await mock.waitForRoster(_converse, 'current', 2, include_nick);
        await mock.openControlBox(_converse);

        const msg_text = '> _ >';
        const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const msg = $msg({
                'from': sender_jid,
                'id': u.getUniqueId(),
                'to': _converse.connection.jid,
                'type': 'chat',
                'xmlns': 'jabber:client'
            }).c('body').t(msg_text).up()
              .c('unstyled', {'xmlns': 'urn:xmpp:styling:0'}).tree();
        await _converse.handleMessageStanza(msg);

        const view = _converse.chatboxviews.get(sender_jid);
        await u.waitUntil(() => view.model.messages.length);
        expect(view.model.messages.models[0].get('is_unstyled')).toBe(true);

        setTimeout(() => {
            const msg_el = view.querySelector('converse-chat-message-body');
            expect(msg_el.innerText).toBe(msg_text);
        }, 500);
    }));


    it("can have styling disabled via the allow_message_styling setting",
        mock.initConverse(['chatBoxesFetched'], {'allow_message_styling': false},
            async function (_converse) {

        const include_nick = false;
        await mock.waitForRoster(_converse, 'current', 2, include_nick);
        await mock.openControlBox(_converse);

        const msg_text = '> _ >';
        const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const msg = $msg({
                'from': sender_jid,
                'id': u.getUniqueId(),
                'to': _converse.connection.jid,
                'type': 'chat',
                'xmlns': 'jabber:client'
            }).c('body').t(msg_text).tree();
        await _converse.handleMessageStanza(msg);

        const view = _converse.chatboxviews.get(sender_jid);
        await u.waitUntil(() => view.model.messages.length);
        expect(view.model.messages.models[0].get('is_unstyled')).toBe(false);

        setTimeout(() => {
            const msg_el = view.querySelector('converse-chat-message-body');
            expect(msg_el.innerText).toBe(msg_text);
        }, 500);
    }));

    it("can be styled with span XEP-0393 message styling hints",
        mock.initConverse(['chatBoxesFetched'], {},
            async function (_converse) {

        let msg_text, msg, msg_el;
        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);

        msg_text = "This *message _contains_* styling hints! \`Here's *some* code\`";
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
        msg_el = view.querySelector('converse-chat-message-body');
        expect(msg_el.innerText).toBe(msg_text);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            'This <span class="styling-directive">*</span>'+
                '<b>message <span class="styling-directive">_</span><i>contains</i><span class="styling-directive">_</span></b>'+
                '<span class="styling-directive">*</span>'+
                ' styling hints! '+
                '<span class="styling-directive">`</span><code>Here\'s *some* code</code><span class="styling-directive">`</span>'
        );

        msg_text = "Here's a ~strikethrough section~";
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerText).toBe(msg_text);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            'Here\'s a <span class="styling-directive">~</span><del>strikethrough section</del><span class="styling-directive">~</span>');

        // Span directives containing hyperlinks
        msg_text = "~Check out this site: https://conversejs.org~"
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 3);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerText).toBe(msg_text);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '<span class="styling-directive">~</span>'+
            '<del>Check out this site: <a target="_blank" rel="noopener" href="https://conversejs.org/">https://conversejs.org</a></del>'+
            '<span class="styling-directive">~</span>');

        // Images inside directives aren't shown inline
        const base_url = 'https://conversejs.org';
        msg_text = `*${base_url}/logo/conversejs-filled.svg*`;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 4);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerText).toBe(msg_text);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '<span class="styling-directive">*</span>'+
            '<b><a target="_blank" rel="noopener" href="https://conversejs.org/logo/conversejs-filled.svg">https://conversejs.org/logo/conversejs-filled.svg</a></b>'+
            '<span class="styling-directive">*</span>');

        // Emojis inside directives
        msg_text = `~ Hello! :poop: ~`;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 5);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '<span class="styling-directive">~</span><del> Hello! <span title=":poop:">💩</span> </del><span class="styling-directive">~</span>');

        // Span directives don't cross lines
        msg_text = "This *is not a styling hint \n * _But this is_!";
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 6);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerText).toBe(msg_text);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            'This *is not a styling hint \n'+
            ' * <span class="styling-directive">_</span><i>But this is</i><span class="styling-directive">_</span>!');

        msg_text = `(There are three blocks in this body marked by parens,)\n (but there is no *formatting)\n (as spans* may not escape blocks.)\n ~strikethrough~`;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 7);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerText).toBe(msg_text);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '(There are three blocks in this body marked by parens,)\n'+
            ' (but there is no *formatting)\n'+
            ' (as spans* may not escape blocks.)\n'+
            ' <span class="styling-directive">~</span><del>strikethrough</del><span class="styling-directive">~</span>');

        // Some edge-case (unspecified) spans
        msg_text = `__ hello world _`;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 8);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerText).toBe(msg_text);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '_<span class="styling-directive">_</span><i> hello world </i><span class="styling-directive">_</span>');

        // Directives which are parts of words aren't matched
        msg_text = `Go to ~https://conversejs.org~now _please_`;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 9);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerText).toBe(msg_text);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            'Go to ~https://conversejs.org~now <span class="styling-directive">_</span><i>please</i><span class="styling-directive">_</span>');

        msg_text = `Go to _https://converse_js.org_ _please_`;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 10);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerText).toBe(msg_text);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            'Go to <span class="styling-directive">_</span>'+
            '<i><a target="_blank" rel="noopener" href="https://converse_js.org/">https://converse_js.org</a></i>'+
            '<span class="styling-directive">_</span> <span class="styling-directive">_</span><i>please</i><span class="styling-directive">_</span>');

    }));

    it("can be styled with block XEP-0393 message styling hints",
        mock.initConverse(['chatBoxesFetched'], {},
            async function (_converse) {

        let msg_text, msg, msg_el;
        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);

        msg_text = `Here's a code block: \n\`\`\`\nInside the code-block, <code>hello</code> we don't enable *styling hints* like ~these~\n\`\`\``;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerHTML.replace(/<!-.*?->/g, '')).toBe(
            'Here\'s a code block: \n'+
            '<div class="styling-directive">```</div><code class="block">Inside the code-block, &lt;code&gt;hello&lt;/code&gt; we don\'t enable *styling hints* like ~these~\n'+
            '</code><div class="styling-directive">```</div>'
        );

        msg_text = "```\nignored\n(println \"Hello, world!\")\n```\nThis should show up as monospace, preformatted text ^";
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '<div class="styling-directive">```</div>'+
            '<code class="block">ignored\n(println "Hello, world!")\n</code>'+
            '<div class="styling-directive">```</div>\n'+
            'This should show up as monospace, preformatted text ^');


        msg_text = "```ignored\n (println \"Hello, world!\")\n ```\n\n This should not show up as monospace, *preformatted* text ^";
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 3);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerText).toBe(msg_text);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '```ignored\n (println "Hello, world!")\n ```\n\n'+
            ' This should not show up as monospace, '+
            '<span class="styling-directive">*</span><b>preformatted</b><span class="styling-directive">*</span> text ^');
    }));

    it("can be styled with quote XEP-0393 message styling hints",
        mock.initConverse(['chatBoxesFetched'], {},
            async function (_converse) {

        let msg_text, msg, msg_el;
        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);

        msg_text = `> https://conversejs.org\n> https://conversejs.org`;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerHTML.replace(/<!-.*?->/g, '')).toBe(
            '<blockquote>'+
                '<a target="_blank" rel="noopener" href="https://conversejs.org/">https://conversejs.org</a>\n\u200B\u200B'+
                '<a target="_blank" rel="noopener" href="https://conversejs.org/">https://conversejs.org</a>'+
            '</blockquote>');

        msg_text = `> This is quoted text\n>This is also quoted\nThis is not quoted`;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerHTML.replace(/<!-.*?->/g, '')).toBe(
            '<blockquote>This is quoted text\n\u200BThis is also quoted</blockquote>\nThis is not quoted');

        msg_text = `> This is *quoted* text\n>This is \`also _quoted_\`\nThis is not quoted`;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 3);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerHTML.replace(/<!-.*?->/g, '')).toBe(
            '<blockquote>This is <span class="styling-directive">*</span><b>quoted</b><span class="styling-directive">*</span> text\n\u200B'+
            'This is <span class="styling-directive">`</span><code>also _quoted_</code><span class="styling-directive">`</span></blockquote>\n'+
            'This is not quoted');

        msg_text = `> > This is doubly quoted text`;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 4);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerHTML.replace(/<!-.*?->/g, '')).toBe("<blockquote><blockquote>This is doubly quoted text</blockquote></blockquote>");

        msg_text = `>> This is doubly quoted text`;
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 5);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerHTML.replace(/<!-.*?->/g, '')).toBe("<blockquote><blockquote>This is doubly quoted text</blockquote></blockquote>");

        msg_text = ">```\n>ignored\n> <span></span> (println \"Hello, world!\")\n>```\n> This should show up as monospace, preformatted text ^";
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 6);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerHTML.replace(/<!-.*?->/g, '')).toBe(
            '<blockquote>'+
                '<div class="styling-directive">```</div>'+
                '<code class="block">\u200Bignored\n\u200B\u200B&lt;span&gt;&lt;/span&gt; (println "Hello, world!")\n\u200B'+
                '</code><div class="styling-directive">```</div>\n\u200B\u200B'+
                'This should show up as monospace, preformatted text ^'+
            '</blockquote>');

        msg_text = '> ```\n> (println "Hello, world!")\n\nThe entire blockquote is a preformatted text block, but this line is plaintext!';
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 7);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        expect(msg_el.innerHTML.replace(/<!-.*?->/g, '')).toBe(
            '<blockquote>```\n\u200B\u200B(println "Hello, world!")</blockquote>\n\n'+
            'The entire blockquote is a preformatted text block, but this line is plaintext!');

        msg_text = '> Also, icons.js is loaded from /dist, instead of dist.\nhttps://conversejs.org/docs/html/configuration.html#assets-path'
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 8);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '<blockquote>Also, icons.js is loaded from /dist, instead of dist.</blockquote>\n'+
            '<a target="_blank" rel="noopener" href="https://conversejs.org/docs/html/configuration.html#assets-path">https://conversejs.org/docs/html/configuration.html#assets-path</a>');

        msg_text = '> Where is it located?\ngeo:37.786971,-122.399677';
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 9);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '<blockquote>Where is it located?</blockquote>\n'+
            '<a target="_blank" rel="noopener" '+
                'href="https://www.openstreetmap.org/?mlat=37.786971&amp;mlon=-122.399677#map=18/37.786971/-122.399677">https://www.openstreetmap.org/?mlat=37.786971&amp;mlon=-122.399677#map=18/37.786971/-122.399677</a>');

        msg_text = '> What do you think of it?\n :poop:';
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 10);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '<blockquote>What do you think of it?</blockquote>\n <span title=":poop:">💩</span>');

        msg_text = '> What do you think of it?\n~hello~';
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 11);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '<blockquote>What do you think of it?</blockquote>\n<span class="styling-directive">~</span><del>hello</del><span class="styling-directive">~</span>');

        msg_text = 'hello world > this is not a quote';
        msg = mock.createChatMessage(_converse, contact_jid, msg_text)
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 12);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') === 'hello world &gt; this is not a quote');

        msg_text = '> What do you think of it romeo?\n Did you see this romeo?';
        msg = $msg({
                    from: contact_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                }).c('body').t(msg_text).up()
                    .c('reference', {
                        'xmlns':'urn:xmpp:reference:0',
                        'begin':'26',
                        'end':'31',
                        'type':'mention',
                        'uri': _converse.bare_jid
                    })
                    .c('reference', {
                        'xmlns':'urn:xmpp:reference:0',
                        'begin':'51',
                        'end':'56',
                        'type':'mention',
                        'uri': _converse.bare_jid
                    }).nodeTree;
        await _converse.handleMessageStanza(msg);

        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 13);
        msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            `<blockquote>What do you think of it <span class="mention" data-uri="romeo@montague.lit">romeo</span>?</blockquote>\n `+
            `Did you see this <span class="mention" data-uri="romeo@montague.lit">romeo</span>?`);

        expect(true).toBe(true);
    }));

    it("won't style invalid block quotes",
            mock.initConverse(['chatBoxesFetched'], {},
                async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        const msg_text = '```\ncode```';
        const msg = $msg({
                    from: contact_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                }).c('body').t(msg_text).up()
                    .c('reference', {
                        'xmlns':'urn:xmpp:reference:0',
                        'begin':'26',
                        'end':'31',
                        'type':'mention',
                        'uri': _converse.bare_jid
                    })
                    .c('reference', {
                        'xmlns':'urn:xmpp:reference:0',
                        'begin':'51',
                        'end':'56',
                        'type':'mention',
                        'uri': _converse.bare_jid
                    }).nodeTree;
        await _converse.handleMessageStanza(msg);

        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
        const msg_el = Array.from(view.querySelectorAll('converse-chat-message-body')).pop();
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') === '```\ncode```');
        expect(true).toBe(true);
    }));
});


describe("An XEP-0393 styled message ", function () {

    it("can be replaced with a correction and will still render properly",
        mock.initConverse(['chatBoxesFetched'], {},
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);

        const msg_text = `https://conversejs.org\nhttps://opkode.com`;
        const msg_id = u.getUniqueId();
        _converse.handleMessageStanza($msg({
                'from': contact_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                'id': msg_id,
            }).c('body').t(msg_text).tree());
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.querySelector('.chat-msg__text').textContent)
            .toBe('https://conversejs.org\nhttps://opkode.com');

        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);
        const msg_el = view.querySelector('converse-chat-message-body');
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            '<a target="_blank" rel="noopener" href="https://conversejs.org/">https://conversejs.org</a>\n'+
            '<a target="_blank" rel="noopener" href="https://opkode.com/">https://opkode.com</a>'
        );

        _converse.handleMessageStanza($msg({
                'from': contact_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                'id': u.getUniqueId(),
            }).c('body').t(`A\nhttps://conversejs.org\n\nhttps://opkode.com`).up()
            .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());
        await new Promise(resolve => view.model.messages.once('rendered', resolve));

        expect(view.querySelectorAll('.chat-msg__text').length).toBe(1);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            'A\n<a target="_blank" rel="noopener" href="https://conversejs.org/">https://conversejs.org</a>\n\n'+
            '<a target="_blank" rel="noopener" href="https://opkode.com/">https://opkode.com</a>'
        );
    }));

    it("can be sent as a correction by using the up arrow",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        await mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid)
        const view = _converse.chatboxviews.get(contact_jid);
        const textarea = view.querySelector('textarea.chat-textarea');
        const message_form = view.querySelector('converse-message-form');

        textarea.value = `https://conversejs.org\nhttps://opkode.com`;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        const msg_el = view.querySelector('converse-chat-message-body');
        expect(msg_el.innerHTML.replace(/<!-.*?->/g, '')).toBe(
            '<a target="_blank" rel="noopener" href="https://conversejs.org/">https://conversejs.org</a>\n'+
            '<a target="_blank" rel="noopener" href="https://opkode.com/">https://opkode.com</a>'
        );

        expect(textarea.value).toBe('');
        message_form.onKeyDown({
            target: textarea,
            keyCode: 38 // Up arrow
        });

        textarea.value = `A\nhttps://conversejs.org\n\nhttps://opkode.com`;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await new Promise(resolve => view.model.messages.once('rendered', resolve));

        expect(view.querySelectorAll('.chat-msg__text').length).toBe(1);
        await u.waitUntil(() => msg_el.innerHTML.replace(/<!-.*?->/g, '') ===
            'A\n<a target="_blank" rel="noopener" href="https://conversejs.org/">https://conversejs.org</a>\n\n'+
            '<a target="_blank" rel="noopener" href="https://opkode.com/">https://opkode.com</a>'
        );
    }));

});
