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

describe("A contact's cached presence", function () {
    it(
        'goes offline on an unavailable presence when none of its resources were cached',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            const [lost_jid, kept_jid] = [mock.cur_names[0], mock.cur_names[1]].map(
                (name) => name.replace(/ /g, '.').toLowerCase() + '@montague.lit',
            );

            // One contact is cached as online without any resources, as
            // when the resources' store was lost. The other really is online.
            const lost = await api.contacts.get(lost_jid);
            await lost.presence.save({ presence: 'online', show: 'dnd' }, { promise: true });

            api.connection
                .get()
                ._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="${kept_jid}/phone"/>`,
                    ),
                );
            const kept = await api.contacts.get(kept_jid);
            const resource = await u.waitUntil(() => kept.presence.resources.get('phone'));
            await resource.save(null, { promise: true });
            await kept.presence.save(null, { promise: true });

            // The page reloads.
            const vcard_get = api.vcard.get;
            await converse.initialize({
                auto_login: false,
                bosh_service_url: 'montague.lit/http-bind',
                discover_connection_methods: false,
                enable_smacks: false,
                i18n: 'en',
                loglevel: 'error',
                no_trimming: true,
                persistent_store: 'localStorage',
            });
            api.vcard.get = vcard_get;
            await api.user.login('romeo@montague.lit/orchard', 'secret');
            await api.waitUntil('rosterContactsFetched');

            // Without any presence telling us otherwise, the cached status stands.
            const reloaded_lost = await api.contacts.get(lost_jid);
            expect(reloaded_lost).not.toBe(lost);
            await reloaded_lost.presence.resources.hydrated;
            expect(reloaded_lost.presence.resources.length).toBe(0);
            expect(reloaded_lost.getStatus()).toBe('dnd');

            const reloaded_kept = await api.contacts.get(kept_jid);
            await reloaded_kept.presence.resources.hydrated;
            expect(reloaded_kept.presence.resources.get('phone')).toBeDefined();
            expect(reloaded_kept.getStatus()).toBe('online');

            // An unknown resource goes offline. The contact without any
            // resources goes offline with it, the one with a known
            // resource stays online.
            for (const jid of [lost_jid, kept_jid]) {
                api.connection
                    .get()
                    ._dataRecv(
                        mock.createRequest(
                            _converse,
                            stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard"
                                    from="${jid}/laptop" type="unavailable"/>`,
                        ),
                    );
            }
            await u.waitUntil(() => reloaded_lost.getStatus() === 'offline');
            expect(reloaded_kept.getStatus()).toBe('online');
        }),
    );
});
