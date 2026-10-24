import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, u } = converse.env;

/**
 * Sends a presence from one of the contact's resources. It carries no caps, so
 * nothing about the resource's identities is known until disco is asked.
 * @param {any} _converse
 * @param {string} full_jid
 */
function receiveResourcePresence(_converse, full_jid) {
    const presence = stx`<presence xmlns="jabber:client" to="${_converse.jid}" from="${full_jid}"/>`;
    _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
}

describe('A roster contact that identifies as a bot', function () {
    it(
        'is only known to be a bot once a resource advertises the client/bot identity',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const bot_jid = `${contact_jid}/bot`;
            const web_jid = `${contact_jid}/web`;
            receiveResourcePresence(_converse, bot_jid);
            receiveResourcePresence(_converse, web_jid);
            await u.waitUntil(() => _converse.state.presences.get(contact_jid)?.resources.get('bot'));

            // Nothing is known about the resources yet, so the contact is not
            // known to be a bot. That's "unknown", not "a person".
            expect(api.contacts.isBot(contact_jid)).toBe(false);

            // Looking up the entity is what asks disco, and the answer carries
            // the identity.
            const pending = api.disco.entities.create({ jid: bot_jid }, { ignore_cache: true });
            await mock.waitUntilDiscoConfirmed(_converse, bot_jid, [{ category: 'client', type: 'bot' }]);
            await pending;
            await u.waitUntil(() => api.contacts.isBot(contact_jid));
            expect(api.contacts.isBot(bot_jid)).toBe(true);

            // A resource that identifies as a client, not a bot, doesn't make
            // the contact a bot.
            const web = api.disco.entities.create({ jid: web_jid }, { ignore_cache: true });
            await mock.waitUntilDiscoConfirmed(_converse, web_jid, [{ category: 'client', type: 'web' }]);
            await web;
            expect(api.contacts.isBot(web_jid)).toBe(false);
        }),
    );

    it(
        'is answered from known identities, without querying disco#info',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            const contact_jid = mock.cur_names[1].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const resource_jid = `${contact_jid}/unlooked-up`;
            receiveResourcePresence(_converse, resource_jid);
            await u.waitUntil(() => _converse.state.presences.get(contact_jid)?.resources.get('unlooked-up'));

            const connection = api.connection.get();
            const queries_before = connection.IQ_stanzas.length;
            expect(api.contacts.isBot(contact_jid)).toBe(false);
            expect(api.contacts.isBot(resource_jid)).toBe(false);
            expect(connection.IQ_stanzas.length).toBe(queries_before);
            expect(_converse.state.disco_entities.get(resource_jid)).toBeUndefined();
        }),
    );
});
