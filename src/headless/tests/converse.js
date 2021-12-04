/* global mock, converse */

const { Strophe } = converse.env;

describe("Converse", function() {

    describe("A chat state indication", function () {

        it("are sent out when the client becomes or stops being idle",
            mock.initConverse(['discoInitialized'], {}, (_converse) => {

            spyOn(_converse, 'sendCSI').and.callThrough();
            let sent_stanza;
            spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                sent_stanza = stanza;
            });
            let i = 0;
            _converse.idle_seconds = 0; // Usually initialized by registerIntervalHandler
            _converse.disco_entities.get(_converse.domain).features['urn:xmpp:csi:0'] = true; // Mock that the server supports CSI

            _converse.api.settings.set('csi_waiting_time', 3);
            while (i <= _converse.api.settings.get("csi_waiting_time")) {
                expect(_converse.sendCSI).not.toHaveBeenCalled();
                _converse.onEverySecond();
                i++;
            }
            expect(_converse.sendCSI).toHaveBeenCalledWith('inactive');
            expect(Strophe.serialize(sent_stanza)).toBe('<inactive xmlns="urn:xmpp:csi:0"/>');
            _converse.onUserActivity();
            expect(_converse.sendCSI).toHaveBeenCalledWith('active');
            expect(Strophe.serialize(sent_stanza)).toBe('<active xmlns="urn:xmpp:csi:0"/>');
        }));
    });

    describe("Automatic status change", function () {

        it("happens when the client is idle for long enough",
                mock.initConverse(['chatBoxesFetched'], {}, async (_converse) => {

            const { api } = _converse;
            let i = 0;
            // Usually initialized by registerIntervalHandler
            _converse.idle_seconds = 0;
            _converse.auto_changed_status = false;
            _converse.api.settings.set('auto_away', 3);
            _converse.api.settings.set('auto_xa', 6);

            expect(await _converse.api.user.status.get()).toBe('online');
            while (i <= _converse.api.settings.get("auto_away")) {
                _converse.onEverySecond(); i++;
            }
            expect(_converse.auto_changed_status).toBe(true);

            while (i <= api.settings.get('auto_xa')) {
                expect(await _converse.api.user.status.get()).toBe('away');
                _converse.onEverySecond();
                i++;
            }
            expect(await _converse.api.user.status.get()).toBe('xa');
            expect(_converse.auto_changed_status).toBe(true);

            _converse.onUserActivity();
            expect(await _converse.api.user.status.get()).toBe('online');
            expect(_converse.auto_changed_status).toBe(false);

            // Check that it also works for the chat feature
            await _converse.api.user.status.set('chat')
            i = 0;
            while (i <= _converse.api.settings.get("auto_away")) {
                _converse.onEverySecond();
                i++;
            }
            expect(_converse.auto_changed_status).toBe(true);
            while (i <= api.settings.get('auto_xa')) {
                expect(await _converse.api.user.status.get()).toBe('away');
                _converse.onEverySecond();
                i++;
            }
            expect(await _converse.api.user.status.get()).toBe('xa');
            expect(_converse.auto_changed_status).toBe(true);

            _converse.onUserActivity();
            expect(await _converse.api.user.status.get()).toBe('online');
            expect(_converse.auto_changed_status).toBe(false);

            // Check that it doesn't work for 'dnd'
            await _converse.api.user.status.set('dnd');
            i = 0;
            while (i <= _converse.api.settings.get("auto_away")) {
                _converse.onEverySecond();
                i++;
            }
            expect(await _converse.api.user.status.get()).toBe('dnd');
            expect(_converse.auto_changed_status).toBe(false);
            while (i <= api.settings.get('auto_xa')) {
                expect(await _converse.api.user.status.get()).toBe('dnd');
                _converse.onEverySecond();
                i++;
            }
            expect(await _converse.api.user.status.get()).toBe('dnd');
            expect(_converse.auto_changed_status).toBe(false);

            _converse.onUserActivity();
            expect(await _converse.api.user.status.get()).toBe('dnd');
            expect(_converse.auto_changed_status).toBe(false);
        }));
    });

    describe("The \"user\" grouping", function () {

        describe("The \"status\" API", function () {

            it("has a method for getting the user's availability",
                    mock.initConverse(['statusInitialized'], {}, async(_converse) => {
                _converse.xmppstatus.set('status', 'online');
                expect(await _converse.api.user.status.get()).toBe('online');
                _converse.xmppstatus.set('status', 'dnd');
                expect(await _converse.api.user.status.get()).toBe('dnd');
            }));

            it("has a method for setting the user's availability", mock.initConverse(async (_converse) => {
                await _converse.api.user.status.set('away');
                expect(await _converse.xmppstatus.get('status')).toBe('away');
                await _converse.api.user.status.set('dnd');
                expect(await _converse.xmppstatus.get('status')).toBe('dnd');
                await _converse.api.user.status.set('xa');
                expect(await _converse.xmppstatus.get('status')).toBe('xa');
                await _converse.api.user.status.set('chat');
                expect(await _converse.xmppstatus.get('status')).toBe('chat');
                const promise = _converse.api.user.status.set('invalid')
                promise.catch(e => {
                    expect(e.message).toBe('Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1');
                });
            }));

            it("allows setting the status message as well", mock.initConverse(async (_converse) => {
                await _converse.api.user.status.set('away', "I'm in a meeting");
                expect(_converse.xmppstatus.get('status')).toBe('away');
                expect(_converse.xmppstatus.get('status_message')).toBe("I'm in a meeting");
            }));

            it("has a method for getting the user's status message",
                    mock.initConverse(['statusInitialized'], {}, async (_converse) => {
                await _converse.xmppstatus.set('status_message', undefined);
                expect(await _converse.api.user.status.message.get()).toBe(undefined);
                await _converse.xmppstatus.set('status_message', "I'm in a meeting");
                expect(await _converse.api.user.status.message.get()).toBe("I'm in a meeting");
            }));

            it("has a method for setting the user's status message",
                    mock.initConverse(['statusInitialized'], {}, async (_converse) => {
                _converse.xmppstatus.set('status_message', undefined);
                await _converse.api.user.status.message.set("I'm in a meeting");
                expect(_converse.xmppstatus.get('status_message')).toBe("I'm in a meeting");
            }));
        });
    });

    describe("The \"tokens\" API", function () {

        it("has a method for retrieving the next RID", mock.initConverse((_converse) => {
            mock.createContacts(_converse, 'current');
            const old_connection = _converse.connection;
            _converse.connection._proto.rid = '1234';
            expect(_converse.api.tokens.get('rid')).toBe('1234');
            _converse.connection = undefined;
            expect(_converse.api.tokens.get('rid')).toBe(null);
            // Restore the connection
            _converse.connection = old_connection;
        }));

        it("has a method for retrieving the SID", mock.initConverse((_converse) => {
            mock.createContacts(_converse, 'current');
            const old_connection = _converse.connection;
            _converse.connection._proto.sid = '1234';
            expect(_converse.api.tokens.get('sid')).toBe('1234');
            _converse.connection = undefined;
            expect(_converse.api.tokens.get('sid')).toBe(null);
            // Restore the connection
            _converse.connection = old_connection;
        }));
    });

    describe("The \"contacts\" API", function () {

        it("has a method 'get' which returns wrapped contacts",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current');
            let contact = await _converse.api.contacts.get('non-existing@jabber.org');
            expect(contact).toBeFalsy();
            // Check when a single jid is given
            const jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            contact = await _converse.api.contacts.get(jid);
            expect(contact.getDisplayName()).toBe(mock.cur_names[0]);
            expect(contact.get('jid')).toBe(jid);
            // You can retrieve multiple contacts by passing in an array
            const jid2 = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            let list = await _converse.api.contacts.get([jid, jid2]);
            expect(Array.isArray(list)).toBeTruthy();
            expect(list[0].getDisplayName()).toBe(mock.cur_names[0]);
            expect(list[1].getDisplayName()).toBe(mock.cur_names[1]);
            // Check that all JIDs are returned if you call without any parameters
            list = await _converse.api.contacts.get();
            expect(list.length).toBe(mock.cur_names.length);
        }));

        it("has a method 'add' with which contacts can be added",
                mock.initConverse(['rosterInitialized'], {}, async (_converse) => {

            await mock.waitForRoster(_converse, 'current', 0);
            try {
                await _converse.api.contacts.add();
                throw new Error('Call should have failed');
            } catch (e) {
                expect(e.message).toBe('contacts.add: invalid jid');

            }
            try {
                await _converse.api.contacts.add("invalid jid");
                throw new Error('Call should have failed');
            } catch (e) {
                expect(e.message).toBe('contacts.add: invalid jid');
            }
            spyOn(_converse.roster, 'addAndSubscribe');
            await _converse.api.contacts.add("newcontact@example.org");
            expect(_converse.roster.addAndSubscribe).toHaveBeenCalled();
        }));
    });

    describe("The \"plugins\" API", function () {
        it("only has a method 'add' for registering plugins", mock.initConverse((_converse) => {
            expect(Object.keys(converse.plugins)).toEqual(["add"]);
            // Cheating a little bit. We clear the plugins to test more easily.
            const _old_plugins = _converse.pluggable.plugins;
            _converse.pluggable.plugins = [];
            converse.plugins.add('plugin1', {});
            expect(Object.keys(_converse.pluggable.plugins)).toEqual(['plugin1']);
            converse.plugins.add('plugin2', {});
            expect(Object.keys(_converse.pluggable.plugins)).toEqual(['plugin1', 'plugin2']);
            _converse.pluggable.plugins = _old_plugins;
        }));

        describe("The \"plugins.add\" method", function () {
            it("throws an error when multiple plugins attempt to register with the same name",
                    mock.initConverse((_converse) => {  // eslint-disable-line no-unused-vars

                converse.plugins.add('myplugin', {});
                const error = new TypeError('Error: plugin with name "myplugin" has already been registered!');
                expect(() => converse.plugins.add('myplugin', {})).toThrow(error);
            }));
        });
    });
});
