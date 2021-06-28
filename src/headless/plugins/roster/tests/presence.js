/*global mock, converse */

// See: https://xmpp.org/rfcs/rfc3921.html

describe("A received presence stanza", function () {

    it("has its priority taken into account",
        mock.initConverse([], {}, async (_converse) => {

        const u = converse.env.utils;
        mock.openControlBox(_converse);
        await mock.waitForRoster(_converse, 'current');
        const contact_jid = mock.cur_names[8].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const contact = await _converse.api.contacts.get(contact_jid);
        let stanza = u.toStanza(`
            <presence xmlns="jabber:client"
                    to="romeo@montague.lit/converse.js-21770972"
                    from="${contact_jid}/priority-1-resource">
                <priority>1</priority>
                <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" ext="voice-v1 camera-v1 video-v1"
                    ver="AcN1/PEN8nq7AHD+9jpxMV4U6YM=" node="http://pidgin.im/"/>
                <x xmlns="vcard-temp:x:update">
                    <photo>ce51d94f7f22b87a21274abb93710b9eb7cc1c65</photo>
                </x>
                <delay xmlns="urn:xmpp:delay" stamp="2017-02-15T20:26:05Z" from="${contact_jid}/priority-1-resource"/>
            </presence>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(contact.presence.get('show')).toBe('online');
        expect(contact.presence.resources.length).toBe(1);
        expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
        expect(contact.presence.resources.get('priority-1-resource').get('show')).toBe('online');

        stanza = u.toStanza(
        '<presence xmlns="jabber:client"'+
        '          to="romeo@montague.lit/converse.js-21770972"'+
        '          from="'+contact_jid+'/priority-0-resource">'+
        '    <status/>'+
        '    <priority>0</priority>'+
        '    <show>xa</show>'+
        '    <c xmlns="http://jabber.org/protocol/caps" ver="GyIX/Kpa4ScVmsZCxRBboJlLAYU=" hash="sha-1"'+
        '       node="http://www.igniterealtime.org/projects/smack/"/>'+
        '    <delay xmlns="urn:xmpp:delay" stamp="2017-02-15T17:02:24Z" from="'+contact_jid+'/priority-0-resource"/>'+
        '</presence>');
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(contact.presence.get('show')).toBe('online');

        expect(contact.presence.resources.length).toBe(2);
        expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
        expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
        expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
        expect(contact.presence.resources.get('priority-1-resource').get('show')).toBe('online');

        stanza = u.toStanza(
        '<presence xmlns="jabber:client"'+
        '          to="romeo@montague.lit/converse.js-21770972"'+
        '          from="'+contact_jid+'/priority-2-resource">'+
        '    <priority>2</priority>'+
        '    <show>dnd</show>'+
        '</presence>');
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(contact.presence.get('show')).toBe('dnd');
        expect(contact.presence.resources.length).toBe(3);
        expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
        expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
        expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
        expect(contact.presence.resources.get('priority-1-resource').get('show')).toBe('online');
        expect(contact.presence.resources.get('priority-2-resource').get('priority')).toBe(2);
        expect(contact.presence.resources.get('priority-2-resource').get('show')).toBe('dnd');

        stanza = u.toStanza(
        '<presence xmlns="jabber:client"'+
        '          to="romeo@montague.lit/converse.js-21770972"'+
        '          from="'+contact_jid+'/priority-3-resource">'+
        '    <priority>3</priority>'+
        '    <show>away</show>'+
        '</presence>');
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(_converse.roster.get(contact_jid).presence.get('show')).toBe('away');
        expect(contact.presence.resources.length).toBe(4);
        expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
        expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
        expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
        expect(contact.presence.resources.get('priority-1-resource').get('show')).toBe('online');
        expect(contact.presence.resources.get('priority-2-resource').get('priority')).toBe(2);
        expect(contact.presence.resources.get('priority-2-resource').get('show')).toBe('dnd');
        expect(contact.presence.resources.get('priority-3-resource').get('priority')).toBe(3);
        expect(contact.presence.resources.get('priority-3-resource').get('show')).toBe('away');

        stanza = u.toStanza(
        '<presence xmlns="jabber:client"'+
        '          to="romeo@montague.lit/converse.js-21770972"'+
        '          from="'+contact_jid+'/older-priority-1-resource">'+
        '    <priority>1</priority>'+
        '    <show>dnd</show>'+
        '    <delay xmlns="urn:xmpp:delay" stamp="2017-02-15T15:02:24Z" from="'+contact_jid+'/older-priority-1-resource"/>'+
        '</presence>');
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(_converse.roster.get(contact_jid).presence.get('show')).toBe('away');
        expect(contact.presence.resources.length).toBe(5);
        expect(contact.presence.resources.get('older-priority-1-resource').get('priority')).toBe(1);
        expect(contact.presence.resources.get('older-priority-1-resource').get('show')).toBe('dnd');
        expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
        expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
        expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
        expect(contact.presence.resources.get('priority-1-resource').get('show')).toBe('online');
        expect(contact.presence.resources.get('priority-2-resource').get('priority')).toBe(2);
        expect(contact.presence.resources.get('priority-2-resource').get('show')).toBe('dnd');
        expect(contact.presence.resources.get('priority-3-resource').get('priority')).toBe(3);
        expect(contact.presence.resources.get('priority-3-resource').get('show')).toBe('away');

        stanza = u.toStanza(
        '<presence xmlns="jabber:client"'+
        '          to="romeo@montague.lit/converse.js-21770972"'+
        '          type="unavailable"'+
        '          from="'+contact_jid+'/priority-3-resource">'+
        '</presence>');
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(_converse.roster.get(contact_jid).presence.get('show')).toBe('dnd');
        expect(contact.presence.resources.length).toBe(4);
        expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
        expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
        expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
        expect(contact.presence.resources.get('priority-1-resource').get('show')).toBe('online');
        expect(contact.presence.resources.get('priority-2-resource').get('priority')).toBe(2);
        expect(contact.presence.resources.get('priority-2-resource').get('show')).toBe('dnd');
        expect(contact.presence.resources.get('older-priority-1-resource').get('priority')).toBe(1);
        expect(contact.presence.resources.get('older-priority-1-resource').get('show')).toBe('dnd');

        stanza = u.toStanza(
        '<presence xmlns="jabber:client"'+
        '          to="romeo@montague.lit/converse.js-21770972"'+
        '          type="unavailable"'+
        '          from="'+contact_jid+'/priority-2-resource">'+
        '</presence>');
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(_converse.roster.get(contact_jid).presence.get('show')).toBe('online');
        expect(contact.presence.resources.length).toBe(3);
        expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
        expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
        expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
        expect(contact.presence.resources.get('priority-1-resource').get('show')).toBe('online');
        expect(contact.presence.resources.get('older-priority-1-resource').get('priority')).toBe(1);
        expect(contact.presence.resources.get('older-priority-1-resource').get('show')).toBe('dnd');

        stanza = u.toStanza(
        '<presence xmlns="jabber:client"'+
        '          to="romeo@montague.lit/converse.js-21770972"'+
        '          type="unavailable"'+
        '          from="'+contact_jid+'/priority-1-resource">'+
        '</presence>');
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(_converse.roster.get(contact_jid).presence.get('show')).toBe('dnd');
        expect(contact.presence.resources.length).toBe(2);
        expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
        expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
        expect(contact.presence.resources.get('older-priority-1-resource').get('priority')).toBe(1);
        expect(contact.presence.resources.get('older-priority-1-resource').get('show')).toBe('dnd');

        stanza = u.toStanza(
        '<presence xmlns="jabber:client"'+
        '          to="romeo@montague.lit/converse.js-21770972"'+
        '          type="unavailable"'+
        '          from="'+contact_jid+'/older-priority-1-resource">'+
        '</presence>');
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(_converse.roster.get(contact_jid).presence.get('show')).toBe('xa');
        expect(contact.presence.resources.length).toBe(1);
        expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
        expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');

        stanza = u.toStanza(
        '<presence xmlns="jabber:client"'+
        '          to="romeo@montague.lit/converse.js-21770972"'+
        '          type="unavailable"'+
        '          from="'+contact_jid+'/priority-0-resource">'+
        '</presence>');
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(_converse.roster.get(contact_jid).presence.get('show')).toBe('offline');
        expect(contact.presence.resources.length).toBe(0);
    }));
});
