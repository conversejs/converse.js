import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, u } = converse.env;

// See: https://xmpp.org/rfcs/rfc3921.html

describe('A received presence stanza', function () {
    it(
        'has its priority taken into account',
        mock.initConverse(converse, [], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current');

            const contact_jid = mock.cur_names[8].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const contact = await _converse.api.contacts.get(contact_jid);

            let stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        from="${contact_jid}/priority-1-resource">
                    <priority>1</priority>
                    <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" ext="voice-v1 camera-v1 video-v1"
                        ver="AcN1/PEN8nq7AHD+9jpxMV4U6YM=" node="http://pidgin.im/"/>
                    <delay xmlns="urn:xmpp:delay"
                        stamp="2017-02-15T20:26:05Z"
                        from="${contact_jid}/priority-1-resource"/>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => contact.presence.getStatus() === 'online');
            expect(contact.presence.resources.length).toBe(1);
            expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
            expect(contact.presence.resources.get('priority-1-resource').get('show')).toBeUndefined();
            expect(contact.presence.resources.get('priority-1-resource').get('presence')).toBe('online');

            stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        from="${contact_jid}/priority-0-resource">
                    <status/>
                    <priority>0</priority>
                    <show>xa</show>
                    <c xmlns="http://jabber.org/protocol/caps" ver="GyIX/Kpa4ScVmsZCxRBboJlLAYU=" hash="sha-1"
                        node="http://www.igniterealtime.org/projects/smack/"/>
                    <delay xmlns="urn:xmpp:delay"
                        stamp="2017-02-15T17:02:24Z"
                        from="'+contact_jid+'/priority-0-resource"/>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
            expect(contact.presence.getStatus()).toBe('online');
            await u.waitUntil(() => contact.presence.resources.length === 2);

            expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
            expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
            expect(contact.presence.resources.get('priority-0-resource').get('presence')).toBe('online');
            expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
            expect(contact.presence.resources.get('priority-1-resource').get('show')).toBeUndefined();
            expect(contact.presence.resources.get('priority-1-resource').get('presence')).toBe('online');

            stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        from="${contact_jid}/priority-2-resource">
                    <priority>2</priority>
                    <show>dnd</show>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => contact.presence.getStatus() === 'dnd');
            expect(contact.presence.resources.length).toBe(3);
            expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
            expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
            expect(contact.presence.resources.get('priority-0-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
            expect(contact.presence.resources.get('priority-1-resource').get('show')).toBeUndefined();
            expect(contact.presence.resources.get('priority-1-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-2-resource').get('priority')).toBe(2);
            expect(contact.presence.resources.get('priority-2-resource').get('show')).toBe('dnd');
            expect(contact.presence.resources.get('priority-2-resource').get('presence')).toBe('online');

            stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        from="${contact_jid}/priority-3-resource">
                    <priority>3</priority>
                    <show>away</show>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
            await u.waitUntil(() => contact.presence.getStatus() === 'away');
            expect(contact.presence.resources.length).toBe(4);
            expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
            expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
            expect(contact.presence.resources.get('priority-0-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
            expect(contact.presence.resources.get('priority-1-resource').get('show')).toBeUndefined();
            expect(contact.presence.resources.get('priority-1-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-2-resource').get('priority')).toBe(2);
            expect(contact.presence.resources.get('priority-2-resource').get('show')).toBe('dnd');
            expect(contact.presence.resources.get('priority-2-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-3-resource').get('priority')).toBe(3);
            expect(contact.presence.resources.get('priority-3-resource').get('show')).toBe('away');
            expect(contact.presence.resources.get('priority-3-resource').get('presence')).toBe('online');

            stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        from="${contact_jid}/older-priority-1-resource">
                    <priority>1</priority>
                    <show>dnd</show>
                    <delay xmlns="urn:xmpp:delay"
                        stamp="2017-02-15T15:02:24Z"
                        from="${contact_jid}/older-priority-1-resource"/>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            expect(_converse.roster.get(contact_jid).presence.getStatus()).toBe('away');
            await u.waitUntil(() => contact.presence.resources.length === 5);
            expect(contact.presence.resources.get('older-priority-1-resource').get('priority')).toBe(1);
            expect(contact.presence.resources.get('older-priority-1-resource').get('show')).toBe('dnd');
            expect(contact.presence.resources.get('older-priority-1-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
            expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
            expect(contact.presence.resources.get('priority-0-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
            expect(contact.presence.resources.get('priority-1-resource').get('show')).toBeUndefined();
            expect(contact.presence.resources.get('priority-1-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-2-resource').get('priority')).toBe(2);
            expect(contact.presence.resources.get('priority-2-resource').get('show')).toBe('dnd');
            expect(contact.presence.resources.get('priority-2-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-3-resource').get('priority')).toBe(3);
            expect(contact.presence.resources.get('priority-3-resource').get('show')).toBe('away');
            expect(contact.presence.resources.get('priority-3-resource').get('presence')).toBe('online');

            stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        type="unavailable"
                        from="${contact_jid}/priority-3-resource">
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => _converse.roster.get(contact_jid).presence.getStatus() === 'dnd');
            expect(contact.presence.resources.length).toBe(4);
            expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
            expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
            expect(contact.presence.resources.get('priority-0-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
            expect(contact.presence.resources.get('priority-1-resource').get('show')).toBeUndefined();
            expect(contact.presence.resources.get('priority-1-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-2-resource').get('priority')).toBe(2);
            expect(contact.presence.resources.get('priority-2-resource').get('show')).toBe('dnd');
            expect(contact.presence.resources.get('priority-2-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('older-priority-1-resource').get('priority')).toBe(1);
            expect(contact.presence.resources.get('older-priority-1-resource').get('show')).toBe('dnd');
            expect(contact.presence.resources.get('older-priority-1-resource').get('presence')).toBe('online');

            stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        type="unavailable"
                        from="${contact_jid}/priority-2-resource">
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => _converse.roster.get(contact_jid).presence.getStatus() === 'online');
            expect(contact.presence.resources.length).toBe(3);
            expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
            expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
            expect(contact.presence.resources.get('priority-0-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('priority-1-resource').get('priority')).toBe(1);
            expect(contact.presence.resources.get('priority-1-resource').get('show')).toBeUndefined();
            expect(contact.presence.resources.get('priority-1-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('older-priority-1-resource').get('priority')).toBe(1);
            expect(contact.presence.resources.get('older-priority-1-resource').get('show')).toBe('dnd');
            expect(contact.presence.resources.get('older-priority-1-resource').get('presence')).toBe('online');

            stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        type="unavailable"
                        from="${contact_jid}/priority-1-resource">
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => _converse.roster.get(contact_jid).presence.getStatus() === 'dnd');
            expect(contact.presence.resources.length).toBe(2);
            expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
            expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
            expect(contact.presence.resources.get('priority-0-resource').get('presence')).toBe('online');

            expect(contact.presence.resources.get('older-priority-1-resource').get('priority')).toBe(1);
            expect(contact.presence.resources.get('older-priority-1-resource').get('show')).toBe('dnd');
            expect(contact.presence.resources.get('older-priority-1-resource').get('presence')).toBe('online');

            stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        type="unavailable"
                        from="${contact_jid}/older-priority-1-resource">
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => _converse.roster.get(contact_jid).presence.getStatus() === 'xa');
            expect(contact.presence.resources.length).toBe(1);
            expect(contact.presence.resources.get('priority-0-resource').get('priority')).toBe(0);
            expect(contact.presence.resources.get('priority-0-resource').get('show')).toBe('xa');
            expect(contact.presence.resources.get('priority-0-resource').get('presence')).toBe('online');

            stanza = stx`
                <presence xmlns="jabber:client"
                        to="romeo@montague.lit/converse.js-21770972"
                        type="unavailable"
                        from="${contact_jid}/priority-0-resource">
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => _converse.roster.get(contact_jid).presence.getStatus() === 'offline');
            expect(contact.presence.resources.length).toBe(0);
        }),
    );

    it(
        'of type "unavailable" from our own resource causes us to resend our presence',
        mock.initConverse(converse, [], {}, async (_converse) => {
            // Regression test for the workaround of https://prosody.im/issues/1121.
            // It must match our own *full* JID (`from`), not the bare JID, otherwise
            // the comparison never holds and we'd be treated as offline.
            await mock.waitForRoster(_converse, 'current');

            const own_full_jid = _converse.session.get('jid'); // e.g. romeo@montague.lit/orchard
            expect(own_full_jid).not.toBe(_converse.bare_jid); // sanity: it has a resource

            spyOn(_converse.api.user.presence, 'send');

            const stanza = stx`
                <presence xmlns="jabber:client"
                        to="${_converse.bare_jid}"
                        type="unavailable"
                        from="${own_full_jid}"/>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => _converse.api.user.presence.send.calls.count() === 1);
        }),
    );

    it(
        'from another of our own resources updates our status when synchronize_availability is true',
        mock.initConverse(converse, [], { synchronize_availability: true }, async (_converse) => {
            await mock.waitForRoster(_converse, 'current');

            const { profile } = _converse.state;
            const other_resource = `${_converse.bare_jid}/another-device`;

            const stanza = stx`
                <presence xmlns="jabber:client"
                        to="${_converse.bare_jid}"
                        from="${other_resource}">
                    <show>dnd</show>
                    <status>Doing other things</status>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => profile.get('show') === 'dnd');
            expect(profile.get('presence')).toBe('online');
            expect(profile.get('status_message')).toBe('Doing other things');
        }),
    );
});
