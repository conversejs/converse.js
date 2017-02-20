/*jshint sub:true*/
(function (root, factory) {
    define([
        "jquery",
        "converse-core",
        "mock",
        "test_utils"], factory);
} (this, function ($, converse, mock, test_utils) {
    "use strict";
    var Strophe = converse.env.Strophe;
    var $iq = converse.env.$iq;
    var $pres = converse.env.$pres;
    // See: https://xmpp.org/rfcs/rfc3921.html

    describe("A received presence stanza", function () {

        it("has its priority taken into account", mock.initConverse(function (_converse) {
            test_utils.openControlBox();
            test_utils.createContacts(_converse, 'current'); // Create some contacts so that we can test positioning
            var contact_jid = mock.cur_names[8].replace(/ /g,'.').toLowerCase() + '@localhost';
            var contact = _converse.roster.get(contact_jid);
            var stanza = $(
            '<presence xmlns="jabber:client"'+
            '          to="dummy@localhost/converse.js-21770972"'+
            '          from="'+contact_jid+'/c71f218b-0797-4732-8a88-b42cb1d8557a">'+
            '    <priority>1</priority>'+
            '    <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" ext="voice-v1 camera-v1 video-v1"'+
            '       ver="AcN1/PEN8nq7AHD+9jpxMV4U6YM=" node="http://pidgin.im/"/>'+
            '    <x xmlns="vcard-temp:x:update">'+
            '        <photo>ce51d94f7f22b87a21274abb93710b9eb7cc1c65</photo>'+
            '    </x>'+
            '    <delay xmlns="urn:xmpp:delay" stamp="2017-02-15T20:26:05Z" from="jabbim.hu"/>'+
            '</presence>');
            _converse.connection._dataRecv(test_utils.createRequest(stanza[0]));
            expect(contact.get('chat_status')).toBe('online');
            expect(_.keys(contact.get('resources')).length).toBe(1);
            expect(contact.get('resources')['c71f218b-0797-4732-8a88-b42cb1d8557a']['priority']).toBe(1);
            expect(contact.get('resources')['c71f218b-0797-4732-8a88-b42cb1d8557a']['status']).toBe('online');

            stanza = $(
            '<presence xmlns="jabber:client"'+
            '          id="tYRdj-35"'+
            '          to="dummy@localhost/converse.js-21770972"'+
            '          from="'+contact_jid+'/androidkhydmcKW">'+
            '    <status/>'+
            '    <priority>0</priority>'+
            '    <show>xa</show>'+
            '    <c xmlns="http://jabber.org/protocol/caps" ver="GyIX/Kpa4ScVmsZCxRBboJlLAYU=" hash="sha-1"'+
            '       node="http://www.igniterealtime.org/projects/smack/"/>'+
            '    <delay xmlns="urn:xmpp:delay" stamp="2017-02-15T17:02:24Z" from="jabbim.hu"/>'+
            '</presence>');
            _converse.connection._dataRecv(test_utils.createRequest(stanza[0]));
            expect(_converse.roster.get(contact_jid).get('chat_status')).toBe('online');
            expect(_.keys(contact.get('resources')).length).toBe(2);
            expect(contact.get('resources')['c71f218b-0797-4732-8a88-b42cb1d8557a']['priority']).toBe(1);
            expect(contact.get('resources')['c71f218b-0797-4732-8a88-b42cb1d8557a']['status']).toBe('online');
            expect(contact.get('resources')['androidkhydmcKW']['priority']).toBe(0);
            expect(contact.get('resources')['androidkhydmcKW']['status']).toBe('xa');

            stanza = $(
            '<presence xmlns="jabber:client"'+
            '          id="tYRdj-35"'+
            '          to="dummy@localhost/converse.js-21770972"'+
            '          from="'+contact_jid+'/other-resource">'+
            '    <priority>2</priority>'+
            '    <show>dnd</show>'+
            '</presence>');
            _converse.connection._dataRecv(test_utils.createRequest(stanza[0]));
            expect(_converse.roster.get(contact_jid).get('chat_status')).toBe('dnd');
            expect(_.keys(contact.get('resources')).length).toBe(3);
            expect(contact.get('resources')['c71f218b-0797-4732-8a88-b42cb1d8557a']['priority']).toBe(1);
            expect(contact.get('resources')['c71f218b-0797-4732-8a88-b42cb1d8557a']['status']).toBe('online');
            expect(contact.get('resources')['androidkhydmcKW']['priority']).toBe(0);
            expect(contact.get('resources')['androidkhydmcKW']['status']).toBe('xa');
            expect(contact.get('resources')['other-resource']['priority']).toBe(2);
            expect(contact.get('resources')['other-resource']['status']).toBe('dnd');

            stanza = $(
            '<presence xmlns="jabber:client"'+
            '          id="tYRdj-35"'+
            '          to="dummy@localhost/converse.js-21770972"'+
            '          from="'+contact_jid+'/other-resource">'+
            '    <priority>3</priority>'+
            '    <show>away</show>'+
            '</presence>');
            _converse.connection._dataRecv(test_utils.createRequest(stanza[0]));
            expect(_converse.roster.get(contact_jid).get('chat_status')).toBe('away');
            expect(_.keys(contact.get('resources')).length).toBe(3);
            expect(contact.get('resources')['c71f218b-0797-4732-8a88-b42cb1d8557a']['priority']).toBe(1);
            expect(contact.get('resources')['c71f218b-0797-4732-8a88-b42cb1d8557a']['status']).toBe('online');
            expect(contact.get('resources')['androidkhydmcKW']['priority']).toBe(0);
            expect(contact.get('resources')['androidkhydmcKW']['status']).toBe('xa');
            expect(contact.get('resources')['other-resource']['priority']).toBe(3);
            expect(contact.get('resources')['other-resource']['status']).toBe('away');

            stanza = $(
            '<presence xmlns="jabber:client"'+
            '          to="dummy@localhost/converse.js-21770972"'+
            '          type="unavailable"'+
            '          from="'+contact_jid+'/other-resource">'+
            '</presence>');
            _converse.connection._dataRecv(test_utils.createRequest(stanza[0]));
            expect(_converse.roster.get(contact_jid).get('chat_status')).toBe('online');
            expect(_.keys(contact.get('resources')).length).toBe(2);
            expect(contact.get('resources')['androidkhydmcKW']['priority']).toBe(0);
            expect(contact.get('resources')['androidkhydmcKW']['status']).toBe('xa');
            expect(contact.get('resources')['c71f218b-0797-4732-8a88-b42cb1d8557a']['priority']).toBe(1);
            expect(contact.get('resources')['c71f218b-0797-4732-8a88-b42cb1d8557a']['status']).toBe('online');

            stanza = $(
            '<presence xmlns="jabber:client"'+
            '          to="dummy@localhost/converse.js-21770972"'+
            '          type="unavailable"'+
            '          from="'+contact_jid+'/c71f218b-0797-4732-8a88-b42cb1d8557a">'+
            '</presence>');
            _converse.connection._dataRecv(test_utils.createRequest(stanza[0]));
            expect(_converse.roster.get(contact_jid).get('chat_status')).toBe('xa');
            expect(_.keys(contact.get('resources')).length).toBe(1);
            expect(contact.get('resources')['androidkhydmcKW']['priority']).toBe(0);
            expect(contact.get('resources')['androidkhydmcKW']['status']).toBe('xa');

            stanza = $(
            '<presence xmlns="jabber:client"'+
            '          to="dummy@localhost/converse.js-21770972"'+
            '          type="unavailable"'+
            '          from="'+contact_jid+'/androidkhydmcKW">'+
            '</presence>');
            _converse.connection._dataRecv(test_utils.createRequest(stanza[0]));
            expect(_converse.roster.get(contact_jid).get('chat_status')).toBe('offline');
            expect(_.keys(contact.get('resources')).length).toBe(0);
        }));
    });
}));

