import mock from './mock.js';
import converse from '../dist/converse-headless.js';

const { u, stx, sizzle, Strophe } = converse.env;

const ENTITY = 'plays.shakespeare.lit';

/**
 * @param {any} _converse
 * @param {string} jid
 */
function findDiscoInfoIQ(_converse, jid) {
    const sel = `iq[to="${jid}"] query[xmlns="${Strophe.NS.DISCO_INFO}"]`;
    return _converse.api.connection.get().IQ_stanzas.find((iq) => sizzle(sel, iq).length);
}

describe('Session stores', function () {
    it(
        "aren't shared with the next account using the same storage",
        mock.initConverse(converse, ['discoInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            // Romeo discovers an entity, and sees a contact come online.
            api.disco.entities.get(ENTITY, true);
            const info_iq = await u.waitUntil(() => findDiscoInfoIQ(_converse, ENTITY));
            api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<iq xmlns="jabber:client" type="result" from="${ENTITY}"
                            to="romeo@montague.lit/orchard" id="${info_iq.getAttribute('id')}">
                        <query xmlns="${Strophe.NS.DISCO_INFO}">
                            <identity category="conference" type="text" name="Play-Specific Chatrooms"/>
                            <feature var="${Strophe.NS.MUC}"/>
                        </query>
                    </iq>`,
                ),
            );
            const romeos_entity = await api.disco.entities.get(ENTITY);
            await u.waitUntil(() => romeos_entity.features.length);

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="${contact_jid}/phone"/>`,
                ),
            );
            const romeos_contact = await api.contacts.get(contact_jid);
            await u.waitUntil(() => romeos_contact.presence.resources.length);

            // The process dies without logging out, and Juliet logs in next
            // on the same storage. The mock connection binds Romeo's JID, so
            // have it bind Juliet's.
            const proto = Object.getPrototypeOf(api.connection.get());
            const bind = proto.bind;
            spyOn(proto, 'bind').and.callFake(function () {
                this.jid = 'juliet@montague.lit/balcony';
                return bind.call(this);
            });
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
            await api.user.login('juliet@montague.lit/balcony', 'secret');
            expect(_converse.session.get('bare_jid')).toBe('juliet@montague.lit');

            await api.waitUntil('discoInitialized');
            await mock.waitForRoster(_converse, 'current');

            // Juliet queries the entity herself, rather than reading what
            // Romeo discovered.
            const juliets_entity = await api.disco.entities.get(ENTITY, true);
            await u.waitUntil(() => findDiscoInfoIQ(_converse, ENTITY));
            expect(juliets_entity.features.length).toBe(0);
            expect(juliets_entity.identities.length).toBe(0);

            const juliets_contact = await api.contacts.get(contact_jid);
            expect(juliets_contact.presence.resources.length).toBe(0);
            expect(juliets_contact.presence.get('presence')).toBe('offline');
        }),
    );
});
