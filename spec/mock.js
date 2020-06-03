/*global converse */

const mock = {};
window.mock = mock;
let _converse, initConverse;

const converseLoaded = new Promise(resolve => window.addEventListener('converse-loaded', resolve));

jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000;

mock.initConverse = function (promise_names=[], settings=null, func) {
    if (typeof promise_names === "function") {
        func = promise_names;
        promise_names = []
        settings = null;
    }

    return async done => {
        if (_converse && _converse.api.connection.connected()) {
            await _converse.api.user.logout();
        }
        const el = document.querySelector('#conversejs');
        if (el) {
            el.parentElement.removeChild(el);
        }
        document.title = "Converse Tests";

        await converseLoaded;
        await initConverse(settings);
        await Promise.all((promise_names || []).map(_converse.api.waitUntil));
        try {
            await func(done, _converse);
        } catch(e) {
            console.error(e);
            fail(e);
            await done();
        }
    }
};

window.addEventListener('converse-loaded', () => {
    const { _, u, sizzle, Strophe, dayjs, $iq, $msg, $pres } = converse.env;

    mock.waitUntilDiscoConfirmed = async function (_converse, entity_jid, identities, features=[], items=[], type='info') {
        const iq = await u.waitUntil(() => {
            return _.filter(
                _converse.connection.IQ_stanzas,
                (iq) => sizzle(`iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#${type}"]`, iq).length
            ).pop();
        }, 300);
        const stanza = $iq({
            'type': 'result',
            'from': entity_jid,
            'to': 'romeo@montague.lit/orchard',
            'id': iq.getAttribute('id'),
        }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#'+type});

        _.forEach(identities, function (identity) {
            stanza.c('identity', {'category': identity.category, 'type': identity.type}).up()
        });
        _.forEach(features, function (feature) {
            stanza.c('feature', {'var': feature}).up();
        });
        _.forEach(items, function (item) {
            stanza.c('item', {'jid': item}).up();
        });
        _converse.connection._dataRecv(mock.createRequest(stanza));
    }

    mock.createRequest = function (iq) {
        iq = typeof iq.tree == "function" ? iq.tree() : iq;
        var req = new Strophe.Request(iq, function() {});
        req.getResponse = function () {
            var env = new Strophe.Builder('env', {type: 'mock'}).tree();
            env.appendChild(iq);
            return env;
        };
        return req;
    };

    mock.closeAllChatBoxes = function (_converse) {
        return Promise.all(_converse.chatboxviews.map(view => view.close()));
    };

    mock.openControlBox = async function (_converse) {
        const model = await _converse.api.controlbox.open();
        await u.waitUntil(() => model.get('connected'));
        var toggle = document.querySelector(".toggle-controlbox");
        if (!u.isVisible(document.querySelector("#controlbox"))) {
            if (!u.isVisible(toggle)) {
                u.removeClass('hidden', toggle);
            }
            toggle.click();
        }
        return this;
    };

    mock.closeControlBox = function () {
        const controlbox = document.querySelector("#controlbox");
        if (u.isVisible(controlbox)) {
            const button = controlbox.querySelector(".close-chatbox-button");
            if (!_.isNull(button)) {
                button.click();
            }
        }
        return this;
    };

    mock.waitUntilBookmarksReturned = async function (_converse, bookmarks=[]) {
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options']
        );
        const IQ_stanzas = _converse.connection.IQ_stanzas;
        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('items[node="storage:bookmarks"]', s).length).pop()
        );
        const stanza = $iq({
            'to': _converse.connection.jid,
            'type':'result',
            'id':sent_stanza.getAttribute('id')
        }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
            .c('items', {'node': 'storage:bookmarks'})
                .c('item', {'id': 'current'})
                    .c('storage', {'xmlns': 'storage:bookmarks'});
        bookmarks.forEach(bookmark => {
            stanza.c('conference', {
                'name': bookmark.name,
                'autojoin': bookmark.autojoin,
                'jid': bookmark.jid
            }).c('nick').t(bookmark.nick).up().up()
        });
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await _converse.api.waitUntil('bookmarksInitialized');
    };

    mock.openChatBoxes = function (converse, amount) {
        for (let i=0; i<amount; i++) {
            const jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            converse.roster.get(jid).openChat();
        }
    };

    mock.openChatBoxFor = async function (_converse, jid) {
        await _converse.api.waitUntil('rosterContactsFetched');
        _converse.roster.get(jid).openChat();
        return u.waitUntil(() => _converse.chatboxviews.get(jid), 1000);
    };

    mock.openChatRoomViaModal = async function (_converse, jid, nick='') {
        // Opens a new chatroom
        const model = await _converse.api.controlbox.open('controlbox');
        await u.waitUntil(() => model.get('connected'));
        await mock.openControlBox(_converse);
        const view = await _converse.chatboxviews.get('controlbox');
        const roomspanel = view.roomspanel;
        roomspanel.el.querySelector('.show-add-muc-modal').click();
        mock.closeControlBox(_converse);
        const modal = roomspanel.add_room_modal;
        await u.waitUntil(() => u.isVisible(modal.el), 1500)
        modal.el.querySelector('input[name="chatroom"]').value = jid;
        if (nick) {
            modal.el.querySelector('input[name="nickname"]').value = nick;
        }
        modal.el.querySelector('form input[type="submit"]').click();
        await u.waitUntil(() => _converse.chatboxviews.get(jid), 1000);
        return _converse.chatboxviews.get(jid);
    };

    mock.openChatRoom = function (_converse, room, server) {
        return _converse.api.rooms.open(`${room}@${server}`);
    };

    mock.getRoomFeatures = async function (_converse, muc_jid, features=[]) {
        const room = Strophe.getNodeFromJid(muc_jid);
        muc_jid = muc_jid.toLowerCase();
        const stanzas = _converse.connection.IQ_stanzas;
        const stanza = await u.waitUntil(() => stanzas.filter(
            iq => iq.querySelector(
                `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
            )).pop()
        );
        const features_stanza = $iq({
            'from': muc_jid,
            'id': stanza.getAttribute('id'),
            'to': 'romeo@montague.lit/desktop',
            'type': 'result'
        }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
            .c('identity', {
                'category': 'conference',
                'name': room[0].toUpperCase() + room.slice(1),
                'type': 'text'
            }).up();

        features = features.length ? features : mock.default_muc_features;
        features.forEach(f => features_stanza.c('feature', {'var': f}).up());
        features_stanza.c('x', { 'xmlns':'jabber:x:data', 'type':'result'})
            .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                .c('value').t('http://jabber.org/protocol/muc#roominfo').up().up()
            .c('field', {'type':'text-single', 'var':'muc#roominfo_description', 'label':'Description'})
                .c('value').t('This is the description').up().up()
            .c('field', {'type':'text-single', 'var':'muc#roominfo_occupants', 'label':'Number of occupants'})
                .c('value').t(0);
        _converse.connection._dataRecv(mock.createRequest(features_stanza));
    };


    mock.waitForReservedNick = async function (_converse, muc_jid, nick) {
        const stanzas = _converse.connection.IQ_stanzas;
        const selector = `iq[to="${muc_jid.toLowerCase()}"] query[node="x-roomuser-item"]`;
        const iq = await u.waitUntil(() => stanzas.filter(s => sizzle(selector, s).length).pop());

        // We remove the stanza, otherwise we might get stale stanzas returned in our filter above.
        stanzas.splice(stanzas.indexOf(iq), 1)

        // The XMPP server returns the reserved nick for this user.
        const IQ_id = iq.getAttribute('id');
        const stanza = $iq({
            'type': 'result',
            'id': IQ_id,
            'from': muc_jid,
            'to': _converse.connection.jid
        }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info', 'node': 'x-roomuser-item'});
        if (nick) {
            stanza.c('identity', {'category': 'conference', 'name': nick, 'type': 'text'});
        }
        _converse.connection._dataRecv(mock.createRequest(stanza));
        if (nick) {
            return u.waitUntil(() => nick);
        }
    };


    mock.returnMemberLists = async function (_converse, muc_jid, members=[], affiliations=['member', 'owner', 'admin']) {
        if (affiliations.length === 0) {
            return;
        }
        const stanzas = _converse.connection.IQ_stanzas;

        if (affiliations.includes('member')) {
            const member_IQ = await u.waitUntil(() => _.filter(
                stanzas,
                s => sizzle(`iq[to="${muc_jid}"] query[xmlns="${Strophe.NS.MUC_ADMIN}"] item[affiliation="member"]`, s).length
            ).pop());
            const member_list_stanza = $iq({
                    'from': 'coven@chat.shakespeare.lit',
                    'id': member_IQ.getAttribute('id'),
                    'to': 'romeo@montague.lit/orchard',
                    'type': 'result'
                }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN});
            members.filter(m => m.affiliation === 'member').forEach(m => {
                member_list_stanza.c('item', {
                    'affiliation': m.affiliation,
                    'jid': m.jid,
                    'nick': m.nick
                });
            });
            _converse.connection._dataRecv(mock.createRequest(member_list_stanza));
        }

        if (affiliations.includes('admin')) {
            const admin_IQ = await u.waitUntil(() => _.filter(
                stanzas,
                s => sizzle(`iq[to="${muc_jid}"] query[xmlns="${Strophe.NS.MUC_ADMIN}"] item[affiliation="admin"]`, s).length
            ).pop());
            const admin_list_stanza = $iq({
                    'from': 'coven@chat.shakespeare.lit',
                    'id': admin_IQ.getAttribute('id'),
                    'to': 'romeo@montague.lit/orchard',
                    'type': 'result'
                }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN});
            members.filter(m => m.affiliation === 'admin').forEach(m => {
                admin_list_stanza.c('item', {
                    'affiliation': m.affiliation,
                    'jid': m.jid,
                    'nick': m.nick
                });
            });
            _converse.connection._dataRecv(mock.createRequest(admin_list_stanza));
        }

        if (affiliations.includes('owner')) {
            const owner_IQ = await u.waitUntil(() => _.filter(
                stanzas,
                s => sizzle(`iq[to="${muc_jid}"] query[xmlns="${Strophe.NS.MUC_ADMIN}"] item[affiliation="owner"]`, s).length
            ).pop());
            const owner_list_stanza = $iq({
                    'from': 'coven@chat.shakespeare.lit',
                    'id': owner_IQ.getAttribute('id'),
                    'to': 'romeo@montague.lit/orchard',
                    'type': 'result'
                }).c('query', {'xmlns': Strophe.NS.MUC_ADMIN});
            members.filter(m => m.affiliation === 'owner').forEach(m => {
                owner_list_stanza.c('item', {
                    'affiliation': m.affiliation,
                    'jid': m.jid,
                    'nick': m.nick
                });
            });
            _converse.connection._dataRecv(mock.createRequest(owner_list_stanza));
        }
        return new Promise(resolve => _converse.api.listen.on('membersFetched', resolve));
    };

    mock.receiveOwnMUCPresence = async function (_converse, muc_jid, nick) {
        const sent_stanzas = _converse.connection.sent_stanzas;
        await u.waitUntil(() => sent_stanzas.filter(iq => sizzle('presence history', iq).length).pop());
        const presence = $pres({
                to: _converse.connection.jid,
                from: `${muc_jid}/${nick}`,
                id: u.getUniqueId()
        }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
            .c('item').attrs({
                affiliation: 'owner',
                jid: _converse.bare_jid,
                role: 'moderator'
            }).up()
            .c('status').attrs({code:'110'});
        _converse.connection._dataRecv(mock.createRequest(presence));
    };


    mock.openAndEnterChatRoom = async function (_converse, muc_jid, nick, features=[], members=[]) {
        muc_jid = muc_jid.toLowerCase();
        const room_creation_promise = _converse.api.rooms.open(muc_jid);
        await mock.getRoomFeatures(_converse, muc_jid, features);
        await mock.waitForReservedNick(_converse, muc_jid, nick);
        // The user has just entered the room (because join was called)
        // and receives their own presence from the server.
        // See example 24: https://xmpp.org/extensions/xep-0045.html#enter-pres
        await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);

        await room_creation_promise;
        const view = _converse.chatboxviews.get(muc_jid);
        await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));

        const affs = _converse.muc_fetch_members;
        const all_affiliations = Array.isArray(affs) ? affs :  (affs ? ['member', 'admin', 'owner'] : []);
        await mock.returnMemberLists(_converse, muc_jid, members, all_affiliations);
        await view.model.messages.fetched;
    };

    mock.createContact = async function (_converse, name, ask, requesting, subscription) {
        const jid = name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
        if (_converse.roster.get(jid)) {
            return Promise.resolve();
        }
        const contact = await new Promise((success, error) => {
            _converse.roster.create({
                'ask': ask,
                'fullname': name,
                'jid': jid,
                'requesting': requesting,
                'subscription': subscription
            }, {success, error});
        });
        return contact;
    };

    mock.createContacts = async function (_converse, type, length) {
        /* Create current (as opposed to requesting or pending) contacts
            * for the user's roster.
            *
            * These contacts are not grouped. See below.
            */
        await _converse.api.waitUntil('rosterContactsFetched');
        let names, subscription, requesting, ask;
        if (type === 'requesting') {
            names = mock.req_names;
            subscription = 'none';
            requesting = true;
            ask = null;
        } else if (type === 'pending') {
            names = mock.pend_names;
            subscription = 'none';
            requesting = false;
            ask = 'subscribe';
        } else if (type === 'current') {
            names = mock.cur_names;
            subscription = 'both';
            requesting = false;
            ask = null;
        } else if (type === 'all') {
            await this.createContacts(_converse, 'current');
            await this.createContacts(_converse, 'requesting')
            await this.createContacts(_converse, 'pending');
            return this;
        } else {
            throw Error("Need to specify the type of contact to create");
        }
        const promises = names.slice(0, length).map(n => this.createContact(_converse, n, ask, requesting, subscription));
        await Promise.all(promises);
    };

    mock.waitForRoster = async function (_converse, type='current', length=-1, include_nick=true, grouped=true) {
        const s = `iq[type="get"] query[xmlns="${Strophe.NS.ROSTER}"]`;
        const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(iq => sizzle(s, iq).length).pop());

        const result = $iq({
            'to': _converse.connection.jid,
            'type': 'result',
            'id': iq.getAttribute('id')
        }).c('query', {
            'xmlns': 'jabber:iq:roster'
        });
        if (type === 'pending' || type === 'all') {
            const pend_names = (length > -1) ? mock.pend_names.slice(0, length) : mock.pend_names;
            pend_names.map(name =>
                result.c('item', {
                    jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                    name: include_nick ? name : undefined,
                    subscription: 'none',
                    ask: 'subscribe'
                }).up()
            );
        }
        if (type === 'current' || type === 'all') {
            const cur_names = Object.keys(mock.current_contacts_map);
            const names = (length > -1) ? cur_names.slice(0, length) : cur_names;
            names.forEach(name => {
                result.c('item', {
                    jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                    name: include_nick ? name : undefined,
                    subscription: 'both',
                    ask: null
                });
                if (grouped) {
                    mock.current_contacts_map[name].forEach(g => result.c('group').t(g).up());
                }
                result.up();
            });
        }
        _converse.connection._dataRecv(mock.createRequest(result));
        await _converse.api.waitUntil('rosterContactsFetched');
    };

    mock.createChatMessage = function (_converse, sender_jid, message) {
        return $msg({
                    from: sender_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                })
                .c('body').t(message).up()
                .c('markable', {'xmlns': Strophe.NS.MARKERS}).up()
                .c('active', {'xmlns': Strophe.NS.CHATSTATES}).tree();
    }

    mock.sendMessage = function (view, message) {
        const promise = new Promise(resolve => view.model.messages.once('rendered', resolve));
        view.el.querySelector('.chat-textarea').value = message;
        view.onKeyDown({
            target: view.el.querySelector('textarea.chat-textarea'),
            preventDefault: _.noop,
            keyCode: 13
        });
        return promise;
    };


    window.libsignal = {
        'SignalProtocolAddress': function (name, device_id) {
            this.name = name;
            this.deviceId = device_id;
        },
        'SessionCipher': function (storage, remote_address) {
            this.remoteAddress = remote_address;
            this.storage = storage;
            this.encrypt = () => Promise.resolve({
                'type': 1,
                'body': 'c1ph3R73X7',
                'registrationId': '1337'
            });
            this.decryptPreKeyWhisperMessage = (key_and_tag) => {
                return Promise.resolve(key_and_tag);
            };
            this.decryptWhisperMessage = (key_and_tag) => {
                return Promise.resolve(key_and_tag);
            }
        },
        'SessionBuilder': function (storage, remote_address) { // eslint-disable-line no-unused-vars
            this.processPreKey = function () {
                return Promise.resolve();
            }
        },
        'KeyHelper': {
            'generateIdentityKeyPair': function () {
                return Promise.resolve({
                    'pubKey': new TextEncoder('utf-8').encode('1234'),
                    'privKey': new TextEncoder('utf-8').encode('4321')
                });
            },
            'generateRegistrationId': function () {
                return '123456789';
            },
            'generatePreKey': function (keyid) {
                return Promise.resolve({
                    'keyId': keyid,
                    'keyPair': {
                        'pubKey': new TextEncoder('utf-8').encode('1234'),
                        'privKey': new TextEncoder('utf-8').encode('4321')
                    }
                });
            },
            'generateSignedPreKey': function (identity_keypair, keyid) {
                return Promise.resolve({
                    'signature': new TextEncoder('utf-8').encode('11112222333344445555'),
                    'keyId': keyid,
                    'keyPair': {
                        'pubKey': new TextEncoder('utf-8').encode('1234'),
                        'privKey': new TextEncoder('utf-8').encode('4321')
                    }
                });
            }
        }
    };

    mock.default_muc_features = [
        'http://jabber.org/protocol/muc',
        'jabber:iq:register',
        Strophe.NS.SID,
        Strophe.NS.MAM,
        'muc_passwordprotected',
        'muc_hidden',
        'muc_temporary',
        'muc_open',
        'muc_unmoderated',
        'muc_anonymous'
    ];

    mock.view_mode = 'overlayed';

    // Names from http://www.fakenamegenerator.com/
    mock.req_names = [
        'Escalus, prince of Verona', 'The Nurse', 'Paris'
    ];
    mock.pend_names = [
        'Lord Capulet', 'Guard', 'Servant'
    ];
    mock.current_contacts_map = {
        'Mercutio': ['Colleagues', 'friends & acquaintences'],
        'Juliet Capulet': ['friends & acquaintences'],
        'Lady Montague': ['Colleagues', 'Family'],
        'Lord Montague': ['Family'],
        'Friar Laurence': ['friends & acquaintences'],
        'Tybalt': ['friends & acquaintences'],
        'Lady Capulet': ['ænemies'],
        'Benviolo': ['friends & acquaintences'],
        'Balthasar': ['Colleagues'],
        'Peter': ['Colleagues'],
        'Abram': ['Colleagues'],
        'Sampson': ['Colleagues'],
        'Gregory': ['friends & acquaintences'],
        'Potpan': [],
        'Friar John': []
    };

    const map = mock.current_contacts_map;
    const groups_map = {};
    Object.keys(map).forEach(k => {
        const groups = map[k].length ? map[k] : ["Ungrouped"];
        Object.values(groups).forEach(g => {
            groups_map[g] = groups_map[g] ? [...groups_map[g], k] : [k]
        });
    });
    mock.groups_map = groups_map;

    mock.cur_names = Object.keys(mock.current_contacts_map);
    mock.num_contacts = mock.req_names.length + mock.pend_names.length + mock.cur_names.length;

    mock.groups = {
        'colleagues': 3,
        'friends & acquaintences': 3,
        'Family': 4,
        'ænemies': 3,
        'Ungrouped': 2
    };

    mock.chatroom_names = [
        'Dyon van de Wege',
        'Thomas Kalb',
        'Dirk Theissen',
        'Felix Hofmann',
        'Ka Lek',
        'Anne Ebersbacher'
    ];
    // TODO: need to also test other roles and affiliations
    mock.chatroom_roles = {
        'Anne Ebersbacher': { affiliation: "owner", role: "moderator" },
        'Dirk Theissen': { affiliation: "admin", role: "moderator" },
        'Dyon van de Wege': { affiliation: "member", role: "occupant" },
        'Felix Hofmann': { affiliation: "member", role: "occupant" },
        'Ka Lek': { affiliation: "member", role: "occupant" },
        'Thomas Kalb': { affiliation: "member", role: "occupant" }
    };

    mock.event = {
        'preventDefault': function () {}
    };

    function clearIndexedDB () {
        const promise = u.getResolveablePromise();
        const db_request = window.indexedDB.open("converse-test-persistent");
        db_request.onsuccess = function () {
            const db = db_request.result;
            const bare_jid = "romeo@montague.lit";
            let store;
            try {
                store= db.transaction([bare_jid], "readwrite").objectStore(bare_jid);
            } catch (e) {
                return promise.resolve();
            }
            const request = store.clear();
            request.onsuccess = promise.resolve();
            request.onerror = promise.resolve();
        };
        db_request.onerror = function (ev) {
            return promise.reject(ev.target.error);
        }
        return promise;
    }

    function clearStores () {
        [localStorage, sessionStorage].forEach(
            s => Object.keys(s).forEach(k => k.match(/^converse-test-/) && s.removeItem(k))
        );
        const cache_key = `converse.room-bookmarksromeo@montague.lit`;
        window.sessionStorage.removeItem(cache_key+'fetched');
    }

    initConverse = async (settings) => {
        clearStores();
        await clearIndexedDB();

        _converse = await converse.initialize(Object.assign({
            'animate': false,
            'auto_subscribe': false,
            'bosh_service_url': 'montague.lit/http-bind',
            'discover_connection_methods': false,
            'enable_smacks': false,
            'i18n': 'en',
            // 'persistent_store': 'IndexedDB',
            'loglevel': 'warn',
            'no_trimming': true,
            'play_sounds': false,
            'use_emojione': false,
            'view_mode': mock.view_mode
        }, settings || {}));

        _converse.ChatBoxViews.prototype.trimChat = function () {};

        _converse.api.vcard.get = function (model, force) {
            let jid;
            if (_.isString(model)) {
                jid = model;
            } else if (!model.get('vcard_updated') || force) {
                jid = model.get('jid') || model.get('muc_jid');
            }
            let fullname;
            if (!jid || jid == 'romeo@montague.lit') {
                jid = 'romeo@montague.lit';
                fullname = 'Romeo Montague' ;
            } else {
                const name = jid.split('@')[0].replace(/\./g, ' ').split(' ');
                const last = name.length-1;
                name[0] =  name[0].charAt(0).toUpperCase()+name[0].slice(1);
                name[last] = name[last].charAt(0).toUpperCase()+name[last].slice(1);
                fullname = name.join(' ');
            }
            const vcard = $iq().c('vCard').c('FN').t(fullname).nodeTree;
            return {
                'vcard': vcard,
                'fullname': _.get(vcard.querySelector('FN'), 'textContent'),
                'image': _.get(vcard.querySelector('PHOTO BINVAL'), 'textContent'),
                'image_type': _.get(vcard.querySelector('PHOTO TYPE'), 'textContent'),
                'url': _.get(vcard.querySelector('URL'), 'textContent'),
                'vcard_updated': dayjs().format(),
                'vcard_error': undefined
            };
        };
        if (_.get(settings, 'auto_login') !== false) {
            _converse.api.user.login('romeo@montague.lit/orchard', 'secret');
            await _converse.api.waitUntil('afterResourceBinding');
        }
        window.converse_disable_effects = true;
        return _converse;
    }
});

converse.load();
