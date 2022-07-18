/*global mock, converse */
const u = converse.env.utils;
const sizzle = converse.env.sizzle;

const { Strophe } = converse.env;

describe("A Jingle Message Initiation Request", function () {

    fit("is sent out when the user clicks the call button", mock.initConverse(
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
            const call_button = view.querySelector('converse-jingle-toolbar-button button');
    // the first click starts the call, and the other one ends it
    call_button.click();
    call_button.click();
    const sent_stanzas = _converse.connection.sent_stanzas;
    const stanza = await u.waitUntil(() => sent_stanzas.filter(s => sizzle(`reason`, s).length).pop());
    expect(Strophe.serialize(stanza)).toBe(
        `<message from='${_converse.bare_jid}'
            to='${contact_jid}'
            type='chat'>`+
                `<retract xmlns='${Strophe.NS.JINGLEMESSAGE}' id='${stanza.getAttribute('id')}'>`+
                    `<reason xmlns="${Strophe.NS.JINGLE}">`+
                        `<cancel/>`+
                        `<text>Retracted</text>`+
                    `</reason>`+
            `   </retract>`+
            `<store xmlns='${Strophe.NS.HINTS}'/>`+
        `</message>`
    );
    expect(view.model.messages.length).toEqual(1);
    }));
});
