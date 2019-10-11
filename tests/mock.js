(function (root, factory) {
    define("mock", [], factory);
}(this, function () {

    converse.load();

    const _ = converse.env._;
    const Promise = converse.env.Promise;
    const Strophe = converse.env.Strophe;
    const dayjs = converse.env.dayjs;
    const $iq = converse.env.$iq;
    const u = converse.env.utils;

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
        'SessionBuilder': function (storage, remote_address) {
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
    mock.view_mode = 'overlayed';

    // Names from http://www.fakenamegenerator.com/
    mock.req_names = [
        'Escalus, prince of Verona', 'The Nurse', 'Paris'
    ];
    mock.pend_names = [
        'Lord Capulet', 'Lady Capulet', 'Servant'
    ];
    mock.cur_names = [
        'Mercutio', 'Juliet Capulet', 'Lady Montague', 'Lord Montague', 'Friar Laurence',
        'Tybalt', 'Lady Capulet', 'Benviolo', 'Balthasar',
        'Peter', 'Abram', 'Sampson', 'Gregory', 'Potpan', 'Friar John'
    ];
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

    mock.mock_connection = function ()  {  // eslint-disable-line wrap-iife
        return function () {
            Strophe.Bosh.prototype._processRequest = function () {}; // Don't attempt to send out stanzas
            const c = new Strophe.Connection('jasmine tests');
            const sendIQ = c.sendIQ;

            c.IQ_stanzas = [];
            c.IQ_ids = [];
            c.sendIQ = function (iq, callback, errback) {
                if (!_.isElement(iq)) {
                    iq = iq.nodeTree;
                }
                this.IQ_stanzas.push(iq);
                const id = sendIQ.bind(this)(iq, callback, errback);
                this.IQ_ids.push(id);
                return id;
            }

            const send = c.send;
            c.sent_stanzas = [];
            c.send = function (stanza) {
                if (_.isElement(stanza)) {
                    this.sent_stanzas.push(stanza);
                } else {
                    this.sent_stanzas.push(stanza.nodeTree);
                }
                return send.apply(this, arguments);
            }

            c.features = Strophe.xmlHtmlNode(
                '<stream:features xmlns:stream="http://etherx.jabber.org/streams" xmlns="jabber:client">'+
                    '<ver xmlns="urn:xmpp:features:rosterver"/>'+
                    '<csi xmlns="urn:xmpp:csi:0"/>'+
                    '<c xmlns="http://jabber.org/protocol/caps" ver="UwBpfJpEt3IoLYfWma/o/p3FFRo=" hash="sha-1" node="http://prosody.im"/>'+
                    '<bind xmlns="urn:ietf:params:xml:ns:xmpp-bind">'+
                        '<required/>'+
                    '</bind>'+
                    `<sm xmlns='urn:xmpp:sm:3'/>`+
                    '<session xmlns="urn:ietf:params:xml:ns:xmpp-session">'+
                        '<optional/>'+
                    '</session>'+
                '</stream:features>').firstChild;

            c._proto._connect = function () {
                c.connected = true;
                c.mock = true;
                c.jid = 'romeo@montague.lit/orchard';
                c._changeConnectStatus(Strophe.Status.BINDREQUIRED);
            };

            c.bind = function () {
                c.authenticated = true;
                this.authenticated = true;
                c._changeConnectStatus(Strophe.Status.CONNECTED);
            };

            c._proto._disconnect = function () {
                c._onDisconnectTimeout();
            }

            c._proto._onDisconnectTimeout = _.noop;
            return c;
        };
    }();

    async function initConverse (settings, spies={}, promises) {
        window.localStorage.clear();
        window.sessionStorage.clear();
        const el = document.querySelector('#conversejs');
        if (el) {
            el.parentElement.removeChild(el);
        }

        const connection = mock.mock_connection();
        if (spies && spies.connection) {
            spies.connection.forEach(method => spyOn(connection, method));
        }

        const _converse = await converse.initialize(Object.assign({
            'i18n': 'en',
            'auto_subscribe': false,
            'play_sounds': false,
            'bosh_service_url': 'montague.lit/http-bind',
            'connection': connection,
            'animate': false,
            'use_emojione': false,
            'no_trimming': true,
            'view_mode': mock.view_mode,
            'debug': false
        }, settings || {}));

        if (spies && spies._converse) {
            spies._converse.forEach(method => spyOn(_converse, method).and.callThrough());
        }

        _converse.ChatBoxViews.prototype.trimChat = function () {};

        _converse.api.vcard.get = function (model, force) {
            return new Promise((resolve, reject) => {
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
                const result = {
                    'vcard': vcard,
                    'fullname': _.get(vcard.querySelector('FN'), 'textContent'),
                    'image': _.get(vcard.querySelector('PHOTO BINVAL'), 'textContent'),
                    'image_type': _.get(vcard.querySelector('PHOTO TYPE'), 'textContent'),
                    'url': _.get(vcard.querySelector('URL'), 'textContent'),
                    'vcard_updated': dayjs().format(),
                    'vcard_error': undefined
                };
                resolve(result);
            }).catch(e => _converse.log(e, Strophe.LogLevel.FATAL));
        };
        if (_.get(settings, 'auto_login') !== false) {
            _converse.api.user.login('romeo@montague.lit/orchard', 'secret');
            await _converse.api.waitUntil('afterResourceBinding');
        }
        window.converse_disable_effects = true;
        return _converse;
    }

    mock.initConverse = function (spies={}, promise_names=[], settings=null, func) {
        if (_.isFunction(spies)) {
            func = spies;
            spies = null;
            promise_names = []
            settings = null;
        }
        return async done => {
            const _converse = await initConverse(settings, spies);
            async function _done () {
                await _converse.api.user.logout();
                const el = document.querySelector('#conversejs');
                el.parentElement.removeChild(el);
                done();
            }
            await Promise.all((promise_names || []).map(_converse.api.waitUntil));
            func(_done, _converse).catch(e => { fail(e); _done(); });
        }
    };
    return mock;
}));
