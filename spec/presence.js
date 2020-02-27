/*jshint sub:true*/
/*eslint dot-notation: "off"*/
(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils",
    ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const u = converse.env.utils;
    // See: https://xmpp.org/rfcs/rfc3921.html

    describe("A sent presence stanza", function () {

        it("includes a entity capabilities node",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                (done, _converse) => {

            _converse.api.disco.own.identities.clear();
            _converse.api.disco.own.features.clear();

            _converse.api.disco.own.identities.add("client", "pc", "Exodus 0.9.1");
            _converse.api.disco.own.features.add("http://jabber.org/protocol/caps");
            _converse.api.disco.own.features.add("http://jabber.org/protocol/disco#info");
            _converse.api.disco.own.features.add("http://jabber.org/protocol/disco#items");
            _converse.api.disco.own.features.add("http://jabber.org/protocol/muc");

            const presence = _converse.xmppstatus.constructPresence();
            expect(presence.toLocaleString()).toBe(
                `<presence xmlns="jabber:client">`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="QgayPKawpkPSDYmwT/WM94uAlu0=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`)
            done();
        }));

        it("has a given priority", mock.initConverse((done, _converse) => {
            let pres = _converse.xmppstatus.constructPresence('online', 'Hello world');
            expect(pres.toLocaleString()).toBe(
                `<presence xmlns="jabber:client">`+
                    `<status>Hello world</status>`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="Hxbsr5fazs62i+O0GxIXf2OEDNs=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`
            );
            _converse.priority = 2;
            pres = _converse.xmppstatus.constructPresence('away', 'Going jogging');
            expect(pres.toLocaleString()).toBe(
                `<presence xmlns="jabber:client">`+
                    `<show>away</show>`+
                    `<status>Going jogging</status>`+
                    `<priority>2</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="Hxbsr5fazs62i+O0GxIXf2OEDNs=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`
            );

            delete _converse.priority;
            pres = _converse.xmppstatus.constructPresence('dnd', 'Doing taxes');
            expect(pres.toLocaleString()).toBe(
                `<presence xmlns="jabber:client">`+
                    `<show>dnd</show>`+
                    `<status>Doing taxes</status>`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="Hxbsr5fazs62i+O0GxIXf2OEDNs=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`
            );
            done();
        }));

        it("includes the saved status message",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async (done, _converse) => {

            test_utils.openControlBox(_converse);
            const view = _converse.xmppstatusview;
            spyOn(view.model, 'sendPresence').and.callThrough();
            spyOn(_converse.connection, 'send').and.callThrough();

            const cbview = _converse.chatboxviews.get('controlbox');
            cbview.el.querySelector('.change-status').click()
            const modal = _converse.xmppstatusview.status_modal;
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            const msg = 'My custom status';
            modal.el.querySelector('input[name="status_message"]').value = msg;
            modal.el.querySelector('[type="submit"]').click();
            expect(view.model.sendPresence).toHaveBeenCalled();
            expect(_converse.connection.send.calls.mostRecent().args[0].toLocaleString())
                .toBe(`<presence xmlns="jabber:client">`+
                        `<status>My custom status</status>`+
                        `<priority>0</priority>`+
                        `<c hash="sha-1" node="https://conversejs.org" ver="Hxbsr5fazs62i+O0GxIXf2OEDNs=" xmlns="http://jabber.org/protocol/caps"/>`+
                        `</presence>`)

            await u.waitUntil(() => modal.el.getAttribute('aria-hidden') === "true");
            await u.waitUntil(() => !u.isVisible(modal.el));
            cbview.el.querySelector('.change-status').click()
            await u.waitUntil(() => modal.el.getAttribute('aria-hidden') === "false", 1000);
            modal.el.querySelector('label[for="radio-busy"]').click(); // Change status to "dnd"
            modal.el.querySelector('[type="submit"]').click();
            expect(_converse.connection.send.calls.mostRecent().args[0].toLocaleString())
                .toBe(`<presence xmlns="jabber:client"><show>dnd</show><status>My custom status</status><priority>0</priority>`+
                        `<c hash="sha-1" node="https://conversejs.org" ver="Hxbsr5fazs62i+O0GxIXf2OEDNs=" xmlns="http://jabber.org/protocol/caps"/>`+
                        `</presence>`)
            done();
        }));
    });

    describe("A received presence stanza", function () {

        it("has its priority taken into account",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async (done, _converse) => {

            test_utils.openControlBox(_converse);
            await test_utils.waitForRoster(_converse, 'current');
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(_converse.roster.get(contact_jid).presence.get('show')).toBe('offline');
            expect(contact.presence.resources.length).toBe(0);
            done();
        }));
    });
}));

