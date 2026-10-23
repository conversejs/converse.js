import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Strophe, u, stx } = converse.env;

describe('A MUC occupant', function () {
    it(
        "does not stores the XEP-0421 occupant id if the feature isn't advertised",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);

            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';
            const model = await mock.openAndEnterMUC(_converse, muc_jid, nick);

            // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
            const id = u.getUniqueId();
            const name = mock.chatroom_names[0];
            const presence = stx`
            <presence
                from="${muc_jid}/${name}"
                id="${u.getUniqueId()}"
                to="${_converse.bare_jid}"
                xmlns="jabber:client">
            <x xmlns="http://jabber.org/protocol/muc#user" />
            <occupant-id xmlns="urn:xmpp:occupant-id:0" id="${id}" />
            </presence>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
            const occupant = await u.waitUntil(() => model.getOccupantByNickname(name));
            expect(occupant.get('occupant_id')).toBe(undefined);
        }),
    );

    it(
        'stores the XEP-0421 occupant id received from a presence stanza',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);

            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, nick, features);

            expect(model.occupants.length).toBe(1);
            expect(model.get('occupant_id')).not.toBeFalsy();
            expect(model.get('occupant_id')).toBe(model.occupants.at(0).get('occupant_id'));

            for (let i = 0; i < mock.chatroom_names.length; i++) {
                // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
                const id = u.getUniqueId();
                const name = mock.chatroom_names[i];
                const presence = stx`
                <presence
                    from="${muc_jid}/${name}"
                    id="${u.getUniqueId()}"
                    to="${_converse.bare_jid}"
                    xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user" />
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="${id}" />
                </presence>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
                const occupant = await u.waitUntil(() => model.getOccupantByNickname(name));
                expect(occupant.get('occupant_id')).toBe(id);
            }
            expect(model.occupants.length).toBe(mock.chatroom_names.length + 1);
        }),
    );

    it(
        'stores our own XEP-0421 occupant id received from a presence stanza when joining a new MUC',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);

            const { api } = _converse;
            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];

            const promise = api.rooms.open(muc_jid, { nick });
            await mock.waitForNewMUCDiscoInfo(_converse, muc_jid);
            await mock.receiveOwnMUCPresence(_converse, muc_jid, nick, 'owner', 'moderator', features);
            await mock.waitForMUCDiscoInfo(_converse, muc_jid, features);

            const model = await promise;

            const entity = await api.disco.entities.get(muc_jid);
            expect(entity.getFeature(Strophe.NS.OCCUPANTID)).toBeTruthy();
            expect(model.occupants.length).toBe(1);
            expect(model.get('occupant_id')).not.toBeFalsy();
            expect(model.get('occupant_id')).toBe(model.occupants.at(0).get('occupant_id'));
        }),
    );

    it(
        'will be added to a MUC message based on the XEP-0421 occupant id',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, nick, features);

            expect(model.occupants.length).toBe(1);
            expect(model.get('occupant_id')).not.toBeFalsy();
            expect(model.get('occupant_id')).toBe(model.occupants.at(0).get('occupant_id'));

            const occupant_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

            const stanza = stx`
            <message
                from='${muc_jid}/3rdwitch'
                id='hysf1v37'
                to='${_converse.bare_jid}'
                type='groupchat'
                xmlns="jabber:client">
            <body>Harpier cries: 'tis time, 'tis time.</body>
            <occupant-id xmlns="urn:xmpp:occupant-id:0" id="dd72603deec90a38ba552f7c68cbcc61bca202cd" />
            </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => model.messages.length);
            let message = model.messages.at(0);
            expect(message.get('occupant_id')).toBe('dd72603deec90a38ba552f7c68cbcc61bca202cd');
            expect(message.occupant).not.toBeUndefined();

            let occupant = message.occupant;
            expect(occupant.getDisplayName()).toBe('3rdwitch');
            expect(occupant.get('nick')).toBe('3rdwitch');
            expect(occupant.get('jid')).toBe(undefined);
            expect(occupant.get('occupant_id')).toBe('dd72603deec90a38ba552f7c68cbcc61bca202cd');

            expect(message.getDisplayName()).toBe('3rdwitch');

            const presence = stx`
            <presence
                from="${muc_jid}/thirdwitch"
                id="${u.getUniqueId()}"
                to="${_converse.bare_jid}"
                xmlns="jabber:client">
            <x xmlns="http://jabber.org/protocol/muc#user">
                <item jid="${occupant_jid}" />
            </x>
            <occupant-id xmlns="urn:xmpp:occupant-id:0" id="dd72603deec90a38ba552f7c68cbcc61bca202cd" />
            </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));

            occupant = await u.waitUntil(() => model.getOccupantByNickname('thirdwitch'));
            expect(occupant.get('occupant_id')).toBe('dd72603deec90a38ba552f7c68cbcc61bca202cd');
            expect(model.occupants.findWhere({ 'occupant_id': 'dd72603deec90a38ba552f7c68cbcc61bca202cd' })).toBe(
                occupant,
            );

            message = model.messages.at(0);
            expect(occupant.get('nick')).toBe('thirdwitch');
            expect(message.occupant).toEqual(occupant);
            expect(message.getDisplayName()).toBe('thirdwitch');
        }),
    );

    it(
        'is not duplicated when a member from the member list joins with an occupant id',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const members = [{ jid: 'juliet@capulet.lit', nick: 'juliet', affiliation: 'member' }];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features, members);
            await u.waitUntil(() => model.occupants.length === 2);
            const juliet = model.occupants.findWhere({ nick: 'juliet' });

            const sendPresence = (show = '') => {
                const presence = stx`
                <presence from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                    ${show ? stx`<show>${show}</show>` : ''}
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="member" role="participant" jid="juliet@capulet.lit/balcony"/>
                    </x>
                    <occupant-id xmlns="urn:xmpp:occupant-id:0" id="juliet-oid" />
                </presence>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
            };

            sendPresence();
            await u.waitUntil(() => juliet.get('presence') === 'online');
            expect(model.occupants.length).toBe(2);
            expect(model.occupants.get('juliet-oid')).toBe(juliet);

            sendPresence('away');
            await u.waitUntil(() => juliet.get('show') === 'away');
            expect(model.occupants.length).toBe(2);
        }),
    );

    it(
        'is not duplicated when created from a message without an occupant id',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);

            const msg = stx`
            <message from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.jid}" type="groupchat" xmlns="jabber:client">
                <body>Hello</body>
            </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, msg));
            await u.waitUntil(() => model.messages.length);
            await u.waitUntil(() => model.occupants.length === 2);
            const juliet = model.occupants.findWhere({ nick: 'juliet' });

            const sendPresence = (show = '') => {
                const presence = stx`
                <presence from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                    ${show ? stx`<show>${show}</show>` : ''}
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" role="participant"/>
                    </x>
                    <occupant-id xmlns="urn:xmpp:occupant-id:0" id="juliet-oid" />
                </presence>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
            };

            sendPresence();
            await u.waitUntil(() => juliet.get('presence') === 'online');
            expect(model.occupants.length).toBe(2);
            expect(model.occupants.get('juliet-oid')).toBe(juliet);

            sendPresence('away');
            await u.waitUntil(() => juliet.get('show') === 'away');
            expect(model.occupants.length).toBe(2);
        }),
    );

    it(
        'is not merged into a member with a different JID who has the same nick',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const members = [{ jid: 'juliet@capulet.lit', nick: 'juliet', affiliation: 'member' }];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features, members);
            await u.waitUntil(() => model.occupants.length === 2);
            const juliet = model.occupants.findWhere({ jid: 'juliet@capulet.lit' });

            const presence = stx`
            <presence from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="none" role="participant" jid="mallory@evil.lit/laptop"/>
                </x>
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="mallory-oid" />
            </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
            await u.waitUntil(() => model.occupants.get('mallory-oid'));
            expect(model.occupants.length).toBe(3);
            expect(model.occupants.get('mallory-oid').get('jid')).toBe('mallory@evil.lit');
            expect(juliet.get('jid')).toBe('juliet@capulet.lit');
            expect(juliet.get('occupant_id')).toBeUndefined();
            expect(juliet.get('presence')).toBe('offline');
        }),
    );

    it(
        "doesn't take the JID of an unaffiliated occupant with the same nick from a presence without one",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const juliet = model.occupants.create({ nick: 'juliet', jid: 'juliet@capulet.lit' });

            const presence = stx`
            <presence from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="none" role="participant"/>
                </x>
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="mallory-oid" />
            </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
            await u.waitUntil(() => model.occupants.get('mallory-oid'));
            expect(model.occupants.length).toBe(3);
            expect(model.occupants.get('mallory-oid').get('jid')).toBeUndefined();
            expect(juliet.get('occupant_id')).toBeUndefined();
        }),
    );

    it(
        'is not duplicated when a member joins with an occupant id but without a JID',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const members = [{ jid: 'juliet@capulet.lit', nick: 'juliet', affiliation: 'member' }];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features, members);
            await u.waitUntil(() => model.occupants.length === 2);

            const presence = stx`
            <presence from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="member" role="participant"/>
                </x>
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="juliet-oid" />
            </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
            await u.waitUntil(() => model.occupants.get('juliet-oid'));
            expect(model.occupants.length).toBe(2);
            expect(model.occupants.get('juliet-oid').get('jid')).toBe('juliet@capulet.lit');
        }),
    );

    it(
        "doesn't take the JID of a member with the same nick from an unaffiliated presence without one",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const members = [{ jid: 'juliet@capulet.lit', nick: 'juliet', affiliation: 'member' }];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features, members);
            await u.waitUntil(() => model.occupants.length === 2);
            const juliet = model.occupants.findWhere({ jid: 'juliet@capulet.lit' });

            const presence = stx`
            <presence from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="none" role="participant"/>
                </x>
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="mallory-oid" />
            </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
            await u.waitUntil(() => model.occupants.get('mallory-oid'));
            expect(model.occupants.length).toBe(3);
            expect(model.occupants.get('mallory-oid').get('jid')).toBeUndefined();
            expect(juliet.get('occupant_id')).toBeUndefined();
        }),
    );

    it(
        "isn't found by an occupant id it doesn't have",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const members = [{ jid: 'juliet@capulet.lit', nick: 'juliet', affiliation: 'member' }];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features, members);
            await u.waitUntil(() => model.occupants.length === 2);
            const juliet = model.occupants.findWhere({ jid: 'juliet@capulet.lit' });

            const data = { occupant_id: 'juliet-oid', nick: 'juliet', jid: 'juliet@capulet.lit' };
            expect(model.occupants.findOccupant(data)).toBeUndefined();
            expect(model.occupants.findOccupantWithoutId(data)).toBe(juliet);
        }),
    );

    it(
        'is not duplicated by a message carrying an occupant id that arrives before their presence',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const members = [{ jid: 'juliet@capulet.lit', nick: 'juliet', affiliation: 'member' }];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features, members);
            await u.waitUntil(() => model.occupants.length === 2);
            const juliet = model.occupants.findWhere({ jid: 'juliet@capulet.lit' });

            const msg = stx`
            <message from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.jid}" type="groupchat" xmlns="jabber:client">
                <body>Hello</body>
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="juliet-oid" />
            </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, msg));
            const message = await u.waitUntil(() => model.messages.at(0));
            expect(message.getOccupant()).toBe(juliet);
            expect(model.occupants.length).toBe(2);
        }),
    );

    it(
        'is matched by the real JID of a message with an occupant id it doesn\'t have',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const members = [{ jid: 'juliet@capulet.lit', nick: 'nurse', affiliation: 'member' }];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features, members);
            await u.waitUntil(() => model.occupants.length === 2);
            const juliet = model.occupants.findWhere({ jid: 'juliet@capulet.lit' });
            // Sorts before juliet and would match by nick, but the JID takes precedence
            const impostor = model.occupants.create({ nick: 'juliet' });
            expect(model.occupants.indexOf(impostor)).toBeLessThan(model.occupants.indexOf(juliet));

            const message = model.messages.create({
                from: `${muc_jid}/juliet`,
                from_real_jid: 'juliet@capulet.lit',
                occupant_id: 'juliet-oid',
                type: 'groupchat',
                body: 'Hello',
            });
            expect(message.getOccupant()).toBe(juliet);
        }),
    );
});
