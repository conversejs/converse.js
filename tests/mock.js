(function (root, factory) {
    define("mock", [], factory);
}(this, function () {

    converse.load();

    const _ = converse.env._;
    const u = converse.env.utils;
    const Promise = converse.env.Promise;
    const Strophe = converse.env.Strophe;
    const dayjs = converse.env.dayjs;
    const $iq = converse.env.$iq;

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

    const mock = {};

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


    let _converse;

    const OriginalConnection = Strophe.Connection;

    function MockConnection (service, options) {
        OriginalConnection.call(this, service, options);

        Strophe.Bosh.prototype._processRequest = function () {}; // Don't attempt to send out stanzas
        const sendIQ = this.sendIQ;

        this.IQ_stanzas = [];
        this.IQ_ids = [];
        this.sendIQ = function (iq, callback, errback) {
            if (!_.isElement(iq)) {
                iq = iq.nodeTree;
            }
            this.IQ_stanzas.push(iq);
            const id = sendIQ.bind(this)(iq, callback, errback);
            this.IQ_ids.push(id);
            return id;
        }

        const send = this.send;
        this.sent_stanzas = [];
        this.send = function (stanza) {
            if (_.isElement(stanza)) {
                this.sent_stanzas.push(stanza);
            } else {
                this.sent_stanzas.push(stanza.nodeTree);
            }
            return send.apply(this, arguments);
        }

        this.features = Strophe.xmlHtmlNode(
            '<stream:features xmlns:stream="http://etherx.jabber.org/streams" xmlns="jabber:client">'+
                '<ver xmlns="urn:xmpp:features:rosterver"/>'+
                '<csi xmlns="urn:xmpp:csi:0"/>'+
                '<this xmlns="http://jabber.org/protocol/caps" ver="UwBpfJpEt3IoLYfWma/o/p3FFRo=" hash="sha-1" node="http://prosody.im"/>'+
                '<bind xmlns="urn:ietf:params:xml:ns:xmpp-bind">'+
                    '<required/>'+
                '</bind>'+
                `<sm xmlns='urn:xmpp:sm:3'/>`+
                '<session xmlns="urn:ietf:params:xml:ns:xmpp-session">'+
                    '<optional/>'+
                '</session>'+
            '</stream:features>').firstChild;

        this._proto._connect = () => {
            this.connected = true;
            this.mock = true;
            this.jid = 'romeo@montague.lit/orchard';
            this._changeConnectStatus(Strophe.Status.BINDREQUIRED);
        };

        this.bind = () => {
            this.authenticated = true;
            this.authenticated = true;
            if (!_converse.no_connection_on_bind) {
                this._changeConnectStatus(Strophe.Status.CONNECTED);
            }
        };

        this._proto._disconnect = () => this._onDisconnectTimeout();
        this._proto._onDisconnectTimeout = _.noop;
    }

    MockConnection.prototype = Object.create(OriginalConnection.prototype);
    Strophe.Connection = MockConnection;


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
    }


    async function initConverse (settings) {
        clearStores();
        await clearIndexedDB();

        _converse = await converse.initialize(Object.assign({
            'animate': false,
            'auto_subscribe': false,
            'bosh_service_url': 'montague.lit/http-bind',
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

    mock.initConverse = function (promise_names=[], settings=null, func) {
        if (_.isFunction(promise_names)) {
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
    return mock;
}));
