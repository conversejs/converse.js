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
        "isn't merged with an unaffiliated occupant that has the same nick while its JID is unknown",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            // E.g. from a member list that doesn't include JIDs
            const juliet = model.occupants.create({ nick: 'juliet', affiliation: 'member' });

            const sendPresence = (affiliation, occupant_id) => {
                const presence = stx`
                <presence from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="${affiliation}" role="participant"/>
                    </x>
                    <occupant-id xmlns="urn:xmpp:occupant-id:0" id="${occupant_id}" />
                </presence>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
                return u.waitUntil(() => model.occupants.get(occupant_id));
            };

            const mallory = await sendPresence('none', 'mallory-oid');
            expect(mallory).not.toBe(juliet);
            expect(model.occupants.length).toBe(3);
            expect(juliet.get('occupant_id')).toBeUndefined();
            expect(juliet.get('affiliation')).toBe('member');

            expect(await sendPresence('member', 'juliet-oid')).toBe(juliet);
            expect(model.occupants.length).toBe(3);
        }),
    );

    it(
        'keeps our own occupant id when a self-presence repeats it or leaves it out',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const occupant_id = model.get('occupant_id');
            expect(occupant_id).toBeTruthy();
            const own_occupant = model.getOwnOccupant();
            // The self-presence handler saves without arguments, unlike
            // the bookmark auto-open that may still be running.
            const save = vi.spyOn(model, 'save');
            const presenceSaves = () => save.mock.calls.filter((args) => !args.length).length;

            const sendSelfPresence = (show, id) => {
                const presence = stx`
                <presence from="${muc_jid}/romeo" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                    <show>${show}</show>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="owner" role="moderator" jid="${_converse.bare_jid}"/>
                        <status code="110"/>
                    </x>
                    ${id ? stx`<occupant-id xmlns="urn:xmpp:occupant-id:0" id="${id}" />` : ''}
                </presence>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
            };

            sendSelfPresence('away', occupant_id);
            await u.waitUntil(() => own_occupant.get('show') === 'away');
            expect(presenceSaves()).toBe(0);

            sendSelfPresence('dnd');
            await u.waitUntil(() => own_occupant.get('show') === 'dnd');
            expect(model.get('occupant_id')).toBe(occupant_id);
            expect(presenceSaves()).toBe(0);
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
            expect(model.occupants.findOccupantWithoutId({ occupant_id: 'juliet-oid', nick: '' })).toBeUndefined();
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
            // Matched only by nick, so it could be someone else's message
            expect(message.get('from_real_jid')).toBeUndefined();
            expect(juliet.get('occupant_id')).toBeUndefined();
        }),
    );

    it(
        'is told apart from another sender with the same nick by their occupant ids',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);

            const sendMessage = (body, occupant_id) => {
                const msg = stx`
                <message from="${muc_jid}/bob" id="${u.getUniqueId()}" to="${_converse.jid}" type="groupchat" xmlns="jabber:client">
                    <body>${body}</body>
                    ${occupant_id ? stx`<occupant-id xmlns="urn:xmpp:occupant-id:0" id="${occupant_id}" />` : ''}
                </message>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, msg));
                return u.waitUntil(() => model.messages.findWhere({ body }));
            };

            // E.g. from the archive, before the server supported occupant ids
            const old_message = await sendMessage('Old');
            await u.waitUntil(() => model.occupants.length === 2);
            const bob = old_message.getOccupant();
            expect(bob.get('occupant_id')).toBeUndefined();

            const message_a = await sendMessage('From A', 'bob-a');
            expect(message_a.getOccupant()).toBe(bob);
            expect(bob.get('occupant_id')).toBe('bob-a');
            expect(model.occupants.get('bob-a')).toBe(bob);
            expect(model.occupants.length).toBe(2);

            const message_b = await sendMessage('From B', 'bob-b');
            expect(message_b.getOccupant()).not.toBe(bob);
            expect(message_b.getOccupant().get('occupant_id')).toBe('bob-b');
            expect(model.occupants.length).toBe(3);

            const presence = stx`
            <presence from="${muc_jid}/bob" id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="none" role="participant"/>
                </x>
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="bob-b" />
            </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
            await u.waitUntil(() => model.occupants.get('bob-b')?.get('presence') === 'online');
            expect(model.occupants.get('bob-b')).toBe(message_b.getOccupant());
            expect(model.occupants.length).toBe(3);
            expect(bob.get('presence')).toBe('offline');
            expect(old_message.getOccupant()).toBe(bob);
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
