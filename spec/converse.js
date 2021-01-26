/* global mock, converse */

const u = converse.env.utils;

describe("Converse", function() {

    it("Can be inserted into a custom element after having been initialized",
            mock.initConverse([], {'root': new DocumentFragment()}, async (done, _converse) => {

        expect(document.body.querySelector('#conversejs')).toBe(null);
        expect(_converse.root.firstElementChild.nodeName.toLowerCase()).toBe('converse-root');
        document.body.appendChild(document.createElement('converse-root'));
        await u.waitUntil(() => document.body.querySelector('#conversejs') !== null);
        done();
    }));

    describe("Authentication", function () {

        it("needs either a bosh_service_url a websocket_url or both", mock.initConverse(async (done, _converse) => {
            const url = _converse.bosh_service_url;
            const connection = _converse.connection;
            _converse.api.settings.set('bosh_service_url', undefined);
            delete _converse.connection;
            try {
                await _converse.initConnection();
            } catch (e) {
                _converse.api.settings.set('bosh_service_url', url);
                _converse.connection = connection;
                expect(e.message).toBe("initConnection: you must supply a value for either the bosh_service_url or websocket_url or both.");
                done();
            }
        }));
    });

    describe("A chat state indication", function () {

        it("are sent out when the client becomes or stops being idle",
            mock.initConverse(['discoInitialized'], {}, (done, _converse) => {

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
            expect(sent_stanza.toLocaleString()).toBe('<inactive xmlns="urn:xmpp:csi:0"/>');
            _converse.onUserActivity();
            expect(_converse.sendCSI).toHaveBeenCalledWith('active');
            expect(sent_stanza.toLocaleString()).toBe('<active xmlns="urn:xmpp:csi:0"/>');
            done();
        }));
    });

    describe("Automatic status change", function () {

        it("happens when the client is idle for long enough",
                mock.initConverse(['initialized'], {}, async (done, _converse) => {
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

            while (i <= _converse.auto_xa) {
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
            while (i <= _converse.auto_xa) {
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
            while (i <= _converse.auto_xa) {
                expect(await _converse.api.user.status.get()).toBe('dnd');
                _converse.onEverySecond();
                i++;
            }
            expect(await _converse.api.user.status.get()).toBe('dnd');
            expect(_converse.auto_changed_status).toBe(false);

            _converse.onUserActivity();
            expect(await _converse.api.user.status.get()).toBe('dnd');
            expect(_converse.auto_changed_status).toBe(false);
            done();
        }));
    });

    describe("The \"user\" grouping", function () {

        describe("The \"status\" API", function () {

            it("has a method for getting the user's availability",
                    mock.initConverse(['statusInitialized'], {}, async(done, _converse) => {
                _converse.xmppstatus.set('status', 'online');
                expect(await _converse.api.user.status.get()).toBe('online');
                _converse.xmppstatus.set('status', 'dnd');
                expect(await _converse.api.user.status.get()).toBe('dnd');
                done();
            }));

            it("has a method for setting the user's availability", mock.initConverse(async (done, _converse) => {
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
                    done();
                });
            }));

            it("allows setting the status message as well", mock.initConverse(async (done, _converse) => {
                await _converse.api.user.status.set('away', "I'm in a meeting");
                expect(_converse.xmppstatus.get('status')).toBe('away');
                expect(_converse.xmppstatus.get('status_message')).toBe("I'm in a meeting");
                done();
            }));

            it("has a method for getting the user's status message",
                    mock.initConverse(['statusInitialized'], {}, async (done, _converse) => {
                await _converse.xmppstatus.set('status_message', undefined);
                expect(await _converse.api.user.status.message.get()).toBe(undefined);
                await _converse.xmppstatus.set('status_message', "I'm in a meeting");
                expect(await _converse.api.user.status.message.get()).toBe("I'm in a meeting");
                done();
            }));

            it("has a method for setting the user's status message",
                    mock.initConverse(['statusInitialized'], {}, async (done, _converse) => {
                _converse.xmppstatus.set('status_message', undefined);
                await _converse.api.user.status.message.set("I'm in a meeting");
                expect(_converse.xmppstatus.get('status_message')).toBe("I'm in a meeting");
                done();
            }));
        });
    });

    describe("The \"tokens\" API", function () {

        it("has a method for retrieving the next RID", mock.initConverse((done, _converse) => {
            mock.createContacts(_converse, 'current');
            const old_connection = _converse.connection;
            _converse.connection._proto.rid = '1234';
            expect(_converse.api.tokens.get('rid')).toBe('1234');
            _converse.connection = undefined;
            expect(_converse.api.tokens.get('rid')).toBe(null);
            // Restore the connection
            _converse.connection = old_connection;
            done();
        }));

        it("has a method for retrieving the SID", mock.initConverse((done, _converse) => {
            mock.createContacts(_converse, 'current');
            const old_connection = _converse.connection;
            _converse.connection._proto.sid = '1234';
            expect(_converse.api.tokens.get('sid')).toBe('1234');
            _converse.connection = undefined;
            expect(_converse.api.tokens.get('sid')).toBe(null);
            // Restore the connection
            _converse.connection = old_connection;
            done();
        }));
    });

    describe("The \"contacts\" API", function () {

        it("has a method 'get' which returns wrapped contacts",
                mock.initConverse([], {}, async function (done, _converse) {

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
            done();
        }));

        it("has a method 'add' with which contacts can be added",
                mock.initConverse(['rosterInitialized'], {}, async (done, _converse) => {

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
            done();
        }));
    });

    describe("The \"chats\" API", function() {

        it("has a method 'get' which returns the promise that resolves to a chat model", mock.initConverse(
                ['rosterInitialized', 'chatBoxesInitialized'], {},
                async (done, _converse) => {

            const u = converse.env.utils;

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 2);

            // Test on chat that doesn't exist.
            let chat = await _converse.api.chats.get('non-existing@jabber.org');
            expect(chat).toBeFalsy();
            const jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const jid2 = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';

            // Test on chat that's not open
            chat = await _converse.api.chats.get(jid);
            expect(chat === null).toBeTruthy();
            expect(_converse.chatboxes.length).toBe(1);

            // Test for one JID
            chat = await _converse.api.chats.open(jid);
            expect(chat instanceof Object).toBeTruthy();
            expect(chat.get('box_id')).toBe(`box-${jid}`);

            const view = _converse.chatboxviews.get(jid);
            await u.waitUntil(() => u.isVisible(view));
            // Test for multiple JIDs
            mock.openChatBoxFor(_converse, jid2);
            await u.waitUntil(() => _converse.chatboxes.length == 3);
            const list = await _converse.api.chats.get([jid, jid2]);
            expect(Array.isArray(list)).toBeTruthy();
            expect(list[0].get('box_id')).toBe(`box-${jid}`);
            expect(list[1].get('box_id')).toBe(`box-${jid2}`);
            done();
        }));

        it("has a method 'open' which opens and returns a promise that resolves to a chat model", mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesInitialized'], {},
                async (done, _converse) => {

            const u = converse.env.utils;
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 2);

            const jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const jid2 = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            // Test on chat that doesn't exist.
            let chat = await _converse.api.chats.get('non-existing@jabber.org');
            expect(chat).toBeFalsy();

            chat = await _converse.api.chats.open(jid);
            expect(chat instanceof Object).toBeTruthy();
            expect(chat.get('box_id')).toBe(`box-${jid}`);
            expect(
                Object.keys(chat),
                ['close', 'endOTR', 'focus', 'get', 'initiateOTR', 'is_chatroom', 'maximize', 'minimize', 'open', 'set']
            );
            const view = _converse.chatboxviews.get(jid);
            await u.waitUntil(() => u.isVisible(view));
            // Test for multiple JIDs
            const list = await _converse.api.chats.open([jid, jid2]);
            expect(Array.isArray(list)).toBeTruthy();
            expect(list[0].get('box_id')).toBe(`box-${jid}`);
            expect(list[1].get('box_id')).toBe(`box-${jid2}`);
            done();
        }));
    });

    describe("The \"settings\" API", function() {
        it("has methods 'get' and 'set' to set configuration settings",
                mock.initConverse(null, {'play_sounds': true}, (done, _converse) => {

            expect(Object.keys(_converse.api.settings)).toEqual(["extend", "update", "get", "set"]);
            expect(_converse.api.settings.get("play_sounds")).toBe(true);
            _converse.api.settings.set("play_sounds", false);
            expect(_converse.api.settings.get("play_sounds")).toBe(false);
            _converse.api.settings.set({"play_sounds": true});
            expect(_converse.api.settings.get("play_sounds")).toBe(true);
            // Only whitelisted settings allowed.
            expect(typeof _converse.api.settings.get("non_existing")).toBe("undefined");
            _converse.api.settings.set("non_existing", true);
            expect(typeof _converse.api.settings.get("non_existing")).toBe("undefined");
            done();
        }));

        it("extended via settings.extend don't override settings passed in via converse.initialize",
                mock.initConverse([], {'emoji_categories': {"travel": ":rocket:"}}, (done, _converse) => {

            expect(_converse.api.settings.get('emoji_categories')?.travel).toBe(':rocket:');

            // Test that the extend command doesn't override user-provided site
            // settings (i.e. settings passed in via converse.initialize).
            _converse.api.settings.extend({'emoji_categories': {"travel": ":motorcycle:", "food": ":burger:"}});

            expect(_converse.api.settings.get('emoji_categories')?.travel).toBe(':rocket:');
            expect(_converse.api.settings.get('emoji_categories')?.food).toBe(undefined);
            done();
        }));

        it("only overrides the passed in properties",
                mock.initConverse([],
                {
                    'root': document.createElement('div').attachShadow({ 'mode': 'open' }),
                    'emoji_categories': { 'travel': ':rocket:' },
                },
                (done, _converse) => {
                    expect(_converse.api.settings.get('emoji_categories')?.travel).toBe(':rocket:');

                    // Test that the extend command doesn't override user-provided site
                    // settings (i.e. settings passed in via converse.initialize).
                    _converse.api.settings.extend({
                        'emoji_categories': { 'travel': ':motorcycle:', 'food': ':burger:' },
                    });

                    expect(_converse.api.settings.get('emoji_categories').travel).toBe(':rocket:');
                    expect(_converse.api.settings.get('emoji_categories').food).toBe(undefined);
                    done();
                }
            )
        );

    });

    describe("The \"plugins\" API", function() {
        it("only has a method 'add' for registering plugins", mock.initConverse((done, _converse) => {
            expect(Object.keys(converse.plugins)).toEqual(["add"]);
            // Cheating a little bit. We clear the plugins to test more easily.
            const _old_plugins = _converse.pluggable.plugins;
            _converse.pluggable.plugins = [];
            converse.plugins.add('plugin1', {});
            expect(Object.keys(_converse.pluggable.plugins)).toEqual(['plugin1']);
            converse.plugins.add('plugin2', {});
            expect(Object.keys(_converse.pluggable.plugins)).toEqual(['plugin1', 'plugin2']);
            _converse.pluggable.plugins = _old_plugins;
            done();
        }));

        describe("The \"plugins.add\" method", function() {
            it("throws an error when multiple plugins attempt to register with the same name",
                    mock.initConverse((done, _converse) => {  // eslint-disable-line no-unused-vars

                converse.plugins.add('myplugin', {});
                const error = new TypeError('Error: plugin with name "myplugin" has already been registered!');
                expect(() => converse.plugins.add('myplugin', {})).toThrow(error);
                done();
            }));
        });
    });
});
