/*global mock, converse */
const u = converse.env.utils;
const sizzle = converse.env.sizzle;

const { Strophe } = converse.env;

fdescribe("A Jingle Message Initiation Request", function () {

    describe("from the initiator's perspective", function () {

    it("is sent out when one clicks the call button", mock.initConverse(
        ['chatBoxesFetched'], {}, async function (_converse) {

    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    const view = _converse.chatboxviews.get(contact_jid);
    const call_button = view.querySelector('converse-jingle-toolbar-button button');
    call_button.click();
    const sent_stanzas = _converse.connection.sent_stanzas;
    const stanza = await u.waitUntil(() => sent_stanzas.filter(s => sizzle(`propose[xmlns='${Strophe.NS.JINGLEMESSAGE}']`, s).length).pop());
    const propose_id = stanza.querySelector('propose');
    expect(Strophe.serialize(stanza)).toBe(
        `<message from="${_converse.bare_jid}" `+
            `id="${stanza.getAttribute('id')}" `+
            `to="${contact_jid}" `+
            `type="chat" `+
            `xmlns="jabber:client">`+
            `<propose id="${propose_id.getAttribute('id')}" xmlns="${Strophe.NS.JINGLEMESSAGE}">`+
                    `<description media="audio" xmlns="${Strophe.NS.JINGLERTP}"/>`+
            `</propose>`+
            `<store xmlns="${Strophe.NS.HINTS}"/>`+
        `</message>`);
    expect(view.model.messages.length).toEqual(1);
    }));


    it("is ended when the initiator clicks the call button again", mock.initConverse(
        ['chatBoxesFetched'], {}, async function (_converse) {

    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    const view = _converse.chatboxviews.get(contact_jid);
    // the first click starts the call, and the other one ends it
    const call_button = view.querySelector('converse-jingle-toolbar-button button');
    call_button.click();
    call_button.click();
    const sent_stanzas = _converse.connection.sent_stanzas;
    const stanza = await u.waitUntil(() => sent_stanzas.filter(s => sizzle(`retract[xmlns='${Strophe.NS.JINGLEMESSAGE}']`, s).length).pop());
    const jingle_retraction_id = stanza.querySelector('retract');
    expect(Strophe.serialize(stanza)).toBe(
        `<message from="${_converse.bare_jid}" `+
            `id="${stanza.getAttribute('id')}" `+
            `to="${contact_jid}" `+
            `type="chat" `+
            `xmlns="jabber:client">`+
                `<retract id="${jingle_retraction_id.getAttribute('id')}" xmlns="${Strophe.NS.JINGLEMESSAGE}">`+
                    `<reason xmlns="${Strophe.NS.JINGLE}">`+
                        `<cancel/>`+
                        `Retracted`+
                    `</reason>`+
                `</retract>`+
            `<store xmlns="${Strophe.NS.HINTS}"/>`+
        `</message>`);
    // This needs to be fixed
    expect(view.model.messages.length).toEqual(1);
    }));

    it("is ended when the initiator clicks the end call header button", mock.initConverse(
        ['chatBoxesFetched'], {}, async function (_converse) {

    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    const view = _converse.chatboxviews.get(contact_jid);
    // the first click starts the call, and the other one ends it
    const call_button = view.querySelector('converse-jingle-toolbar-button button');
    call_button.click();
    const header_end_call_button = await u.waitUntil(() => view.querySelector('.jingle-call-initiated-button'));
    header_end_call_button.click();
    const sent_stanzas = _converse.connection.sent_stanzas;
    const stanza = await u.waitUntil(() => sent_stanzas.filter(s => sizzle(`retract[xmlns='${Strophe.NS.JINGLEMESSAGE}']`, s).length).pop());
    const jingle_retraction_id = stanza.querySelector('retract');
    expect(Strophe.serialize(stanza)).toBe(
        `<message from="${_converse.bare_jid}" `+
            `id="${stanza.getAttribute('id')}" `+
            `to="${contact_jid}" `+
            `type="chat" `+
            `xmlns="jabber:client">`+
                `<retract id="${jingle_retraction_id.getAttribute('id')}" xmlns="${Strophe.NS.JINGLEMESSAGE}">`+
                    `<reason xmlns="${Strophe.NS.JINGLE}">`+
                        `<cancel/>`+
                        `Retracted`+
                    `</reason>`+
                `</retract>`+
            `<store xmlns="${Strophe.NS.HINTS}"/>`+
        `</message>`);
    // This needs to be fixed
    expect(view.model.messages.length).toEqual(1);
    }));
    });
    
    describe("from the receiver's perspective", function () {

        it("is received when the initiator clicks the call button", mock.initConverse(
            ['chatBoxesFetched'], { allow_non_roster_messaging: true }, async function (_converse) {
    
        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
        const propose_id = u.getUniqueId();
        const initiator_stanza = u.toStanza(`
        <message xmlns='jabber:client'
                from='${_converse.bare_jid}'
                to='${contact_jid}'
                type='chat'>
                <propose id="${propose_id}" xmlns="${Strophe.NS.JINGLEMESSAGE}">
                    <description media="audio" xmlns="${Strophe.NS.JINGLERTP}"/>
                </propose>
            <store xmlns='${Strophe.NS.HINTS}'/>
        </message>`);
        _converse.connection._dataRecv(mock.createRequest(initiator_stanza));
                
        const view = await u.waitUntil(() => _converse.chatboxviews.get(contact_jid));
        expect(view.model.messages.length).toEqual(1);
        }));

        it("is received when the initiator clicks the end call button", mock.initConverse(
            ['chatBoxesFetched'], {}, async function (_converse) {
    
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const call_button = view.querySelector('converse-jingle-toolbar-button button');
            call_button.click();
            const sent_stanzas = _converse.connection.sent_stanzas;
            const stanza = await u.waitUntil(() => sent_stanzas.filter(s => sizzle(`propose[xmlns='${Strophe.NS.JINGLEMESSAGE}']`, s).length).pop());
            const propose_id = stanza.querySelector('propose');
            const initiator_stanza = u.toStanza(`
            <message xmlns='jabber:client'
                    from='${_converse.bare_jid}'
                    to='${contact_jid}'
                    type='chat'>
                    <retract id="${propose_id.getAttribute('id')}" xmlns="${Strophe.NS.JINGLEMESSAGE}">
                            <reason xmlns="${Strophe.NS.JINGLE}">
                                <cancel/>
                                <text>Retracted</text>
                            </reason>
                    </retract>
                    <store xmlns='${Strophe.NS.HINTS}'/>
            </message>`);
            _converse.connection._dataRecv(mock.createRequest(initiator_stanza));
            expect(view.model.messages.length).toEqual(1);
        }));
    });
});
