/* global mock, converse */
import mock from '../tests/mock.js';

describe('Converse', function () {
    describe('The "user" grouping', function () {
        describe('The "status" API', function () {
            it(
                "has a method for getting the user's availability",
                mock.initConverse(['statusInitialized'], {}, async (_converse) => {
                    const { profile } = _converse.state;
                    profile.set('status', 'online');
                    expect(await _converse.api.user.status.get()).toBe('online');
                    profile.set('status', 'dnd');
                    expect(await _converse.api.user.status.get()).toBe('dnd');
                })
            );

            it(
                "has a method for setting the user's availability",
                mock.initConverse(async (_converse) => {
                    await _converse.api.user.status.set('away');
                    const { profile } = _converse.state;
                    expect(await profile.get('show')).toBe('dnd');
                    await _converse.api.user.status.set('dnd');
                    expect(await profile.get('show')).toBe('dnd');
                    await _converse.api.user.status.set('xa');
                    expect(await profile.get('show')).toBe('xa');
                    await _converse.api.user.status.set('chat');
                    expect(await profile.get('show')).toBe('chat');
                    const promise = _converse.api.user.status.set('invalid');
                    promise.catch((e) => {
                        expect(e.message).toBe(
                            'Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1'
                        );
                    });
                })
            );

            it(
                'allows setting the status message as well',
                mock.initConverse(async (_converse) => {
                    await _converse.api.user.status.set('away', "I'm in a meeting");
                    const { profile } = _converse.state;
                    expect(profile.get('show')).toBe('dnd');
                    expect(profile.get('status_message')).toBe("I'm in a meeting");
                })
            );

            it(
                "has a method for getting the user's status message",
                mock.initConverse(['statusInitialized'], {}, async (_converse) => {
                    const { profile } = _converse.state;
                    await profile.set('status_message', undefined);
                    expect(await _converse.api.user.status.message.get()).toBe(undefined);
                    await profile.set('status_message', "I'm in a meeting");
                    expect(await _converse.api.user.status.message.get()).toBe("I'm in a meeting");
                })
            );

            it(
                "has a method for setting the user's status message",
                mock.initConverse(['statusInitialized'], {}, async (_converse) => {
                    const { profile } = _converse.state;
                    profile.set('status_message', undefined);
                    await _converse.api.user.status.message.set("I'm in a meeting");
                    expect(profile.get('status_message')).toBe("I'm in a meeting");
                })
            );
        });
    });

    describe('The "tokens" API', function () {
        it(
            'has a method for retrieving the next RID',
            mock.initConverse(['chatBoxesFetched'], {}, ({ api }) => {
                const connection = api.connection.get();
                connection._proto.rid = '1234';
                expect(api.tokens.get('rid')).toBe('1234');
                connection._proto.rid = '1235';
                expect(api.tokens.get('rid')).toBe('1235');
            })
        );

        it(
            'has a method for retrieving the SID',
            mock.initConverse(['chatBoxesFetched'], {}, ({ api }) => {
                const connection = api.connection.get();
                connection._proto.sid = '1234';
                expect(api.tokens.get('sid')).toBe('1234');
                connection._proto.sid = '1235';
                expect(api.tokens.get('sid')).toBe('1235');
            })
        );
    });

    describe('The "contacts" API', function () {
        it(
            "has a method 'get' which returns wrapped contacts",
            mock.initConverse([], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current');
                let contact = await _converse.api.contacts.get('non-existing@jabber.org');
                expect(contact).toBeFalsy();
                // Check when a single jid is given
                const jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                contact = await _converse.api.contacts.get(jid);
                expect(contact.getDisplayName()).toBe(mock.cur_names[0]);
                expect(contact.get('jid')).toBe(jid);
                // You can retrieve multiple contacts by passing in an array
                const jid2 = mock.cur_names[1].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                let list = await _converse.api.contacts.get([jid, jid2]);
                expect(Array.isArray(list)).toBeTruthy();
                expect(list[0].getDisplayName()).toBe(mock.cur_names[0]);
                expect(list[1].getDisplayName()).toBe(mock.cur_names[1]);
                // Check that all JIDs are returned if you call without any parameters
                list = await _converse.api.contacts.get();
                expect(list.length).toBe(mock.cur_names.length);
            })
        );

        it(
            "has a method 'add' with which contacts can be added",
            mock.initConverse(['rosterInitialized'], {}, async (_converse) => {
                const { api } = _converse;

                await mock.waitForRoster(_converse, 'current', 0);
                try {
                    await api.contacts.add();
                    throw new Error('Call should have failed');
                } catch (e) {
                    expect(e.message).toBe('api.contacts.add: Valid JID required');
                }
                try {
                    await api.contacts.add({ jid: 'invalid jid' });
                    throw new Error('Call should have failed');
                } catch (e) {
                    expect(e.message).toBe('api.contacts.add: Valid JID required');
                }

                // Create a contact that doesn't get persisted to the
                // roster, to avoid having to mock stanzas.
                await api.contacts.add({ jid: 'newcontact@example.org' }, false, false);
                const contacts = await api.contacts.get();
                expect(contacts.length).toBe(1);
                expect(contacts[0].get('jid')).toBe('newcontact@example.org');
                expect(contacts[0].get('subscription')).toBe(undefined);
                expect(contacts[0].get('ask')).toBeUndefined();
                expect(contacts[0].get('groups').length).toBe(0);
            })
        );
    });

    describe('The "plugins" API', function () {
        it(
            "only has a method 'add' for registering plugins",
            mock.initConverse((_converse) => {
                expect(Object.keys(converse.plugins)).toEqual(['add']);
                // Cheating a little bit. We clear the plugins to test more easily.
                const _old_plugins = _converse.pluggable.plugins;
                _converse.pluggable.plugins = [];
                converse.plugins.add('plugin1', {});
                expect(Object.keys(_converse.pluggable.plugins)).toEqual(['plugin1']);
                converse.plugins.add('plugin2', {});
                expect(Object.keys(_converse.pluggable.plugins)).toEqual(['plugin1', 'plugin2']);
                _converse.pluggable.plugins = _old_plugins;
            })
        );

        describe('The "plugins.add" method', function () {
            it(
                'throws an error when multiple plugins attempt to register with the same name',
                mock.initConverse((_converse) => {
                    // eslint-disable-line no-unused-vars

                    converse.plugins.add('myplugin', {});
                    const error = new TypeError('Error: plugin with name "myplugin" has already been registered!');
                    expect(() => converse.plugins.add('myplugin', {})).toThrow(error);
                })
            );
        });
    });
});
