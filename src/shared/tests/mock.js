let _converse;
const mock = {};
const converse = window.converse;
converse.load();
const { u, sizzle, Strophe, dayjs, $iq, $msg, $pres } = converse.env;

jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000;

function initConverse (promise_names=[], settings=null, func) {
    if (typeof promise_names === "function") {
        func = promise_names;
        promise_names = []
        settings = null;
    }

    return async () => {
        if (_converse && _converse.api.connection.connected()) {
            await _converse.api.user.logout();
        }
        const el = document.querySelector('#conversejs');
        if (el) {
            el.parentElement.removeChild(el);
        }
        document.title = "Converse Tests";

        await _initConverse(settings);
        await Promise.all((promise_names || []).map(_converse.api.waitUntil));
        try {
            await func(_converse);
        } catch(e) {
            console.error(e);
            fail(e);
        }
    }
}

async function waitUntilDiscoConfirmed (_converse, entity_jid, identities, features=[], items=[], type='info') {
    const sel = `iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#${type}"]`;
    const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());
    const stanza = $iq({
        'type': 'result',
        'from': entity_jid,
        'to': 'romeo@montague.lit/orchard',
        'id': iq.getAttribute('id'),
    }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#'+type});

    identities?.forEach(identity => stanza.c('identity', {'category': identity.category, 'type': identity.type}).up());
    features?.forEach(feature => stanza.c('feature', {'var': feature}).up());
    items?.forEach(item => stanza.c('item', {'jid': item}).up());
    _converse.connection._dataRecv(createRequest(stanza));
}

function createRequest (stanza) {
    stanza = typeof stanza.tree == "function" ? stanza.tree() : stanza;
    const req = new Strophe.Request(stanza, () => {});
    req.getResponse = function () {
        var env = new Strophe.Builder('env', {type: 'mock'}).tree();
        env.appendChild(stanza);
        return env;
    };
    return req;
}

function closeAllChatBoxes (_converse) {
    return Promise.all(_converse.chatboxviews.map(view => view.close()));
}

function toggleControlBox () {
    const toggle = document.querySelector(".toggle-controlbox");
    if (!u.isVisible(document.querySelector("#controlbox"))) {
        if (!u.isVisible(toggle)) {
            u.removeClass('hidden', toggle);
        }
        toggle.click();
    }
}

async function openControlBox(_converse) {
    const model = await _converse.api.controlbox.open();
    await u.waitUntil(() => model.get('connected'));
    toggleControlBox();
    return this;
}

function closeControlBox () {
    const controlbox = document.querySelector("#controlbox");
    if (u.isVisible(controlbox)) {
        const button = controlbox.querySelector(".close-chatbox-button");
        (button !== null) && button.click();
    }
    return this;
}

async function waitUntilBookmarksReturned (_converse, bookmarks=[]) {
    await waitUntilDiscoConfirmed(
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
    _converse.connection._dataRecv(createRequest(stanza));
    await _converse.api.waitUntil('bookmarksInitialized');
}

function openChatBoxes (converse, amount) {
    for (let i=0; i<amount; i++) {
        const jid = cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        converse.roster.get(jid).openChat();
    }
}

async function openChatBoxFor (_converse, jid) {
    await _converse.api.waitUntil('rosterContactsFetched');
    _converse.roster.get(jid).openChat();
    return u.waitUntil(() => _converse.chatboxviews.get(jid), 1000);
}

async function openChatRoomViaModal (_converse, jid, nick='') {
    // Opens a new chatroom
    const model = await _converse.api.controlbox.open('controlbox');
    await u.waitUntil(() => model.get('connected'));
    await openControlBox(_converse);
    document.querySelector('converse-rooms-list .show-add-muc-modal').click();
    closeControlBox(_converse);
    const modal = _converse.api.modal.get('converse-add-muc-modal');
    await u.waitUntil(() => u.isVisible(modal), 1500)
    modal.querySelector('input[name="chatroom"]').value = jid;
    if (nick) {
        modal.querySelector('input[name="nickname"]').value = nick;
    }
    modal.querySelector('form input[type="submit"]').click();
    await u.waitUntil(() => _converse.chatboxviews.get(jid), 1000);
    return _converse.chatboxviews.get(jid);
}

function openChatRoom (_converse, room, server) {
    return _converse.api.rooms.open(`${room}@${server}`);
}

async function getRoomFeatures (_converse, muc_jid, features=[]) {
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

    features = features.length ? features : default_muc_features;
    features.forEach(f => features_stanza.c('feature', {'var': f}).up());
    features_stanza.c('x', { 'xmlns':'jabber:x:data', 'type':'result'})
        .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
            .c('value').t('http://jabber.org/protocol/muc#roominfo').up().up()
        .c('field', {'type':'text-single', 'var':'muc#roominfo_description', 'label':'Description'})
            .c('value').t('This is the description').up().up()
        .c('field', {'type':'text-single', 'var':'muc#roominfo_occupants', 'label':'Number of occupants'})
            .c('value').t(0);
    _converse.connection._dataRecv(createRequest(features_stanza));
}


async function waitForReservedNick (_converse, muc_jid, nick) {
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
    _converse.connection._dataRecv(createRequest(stanza));
    if (nick) {
        return u.waitUntil(() => nick);
    }
}


async function returnMemberLists (_converse, muc_jid, members=[], affiliations=['member', 'owner', 'admin']) {
    if (affiliations.length === 0) {
        return;
    }
    const stanzas = _converse.connection.IQ_stanzas;

    if (affiliations.includes('member')) {
        const member_IQ = await u.waitUntil(() =>
            stanzas.filter(s => sizzle(`iq[to="${muc_jid}"] query[xmlns="${Strophe.NS.MUC_ADMIN}"] item[affiliation="member"]`, s).length
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
        _converse.connection._dataRecv(createRequest(member_list_stanza));
    }

    if (affiliations.includes('admin')) {
        const admin_IQ = await u.waitUntil(() => stanzas.filter(
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
        _converse.connection._dataRecv(createRequest(admin_list_stanza));
    }

    if (affiliations.includes('owner')) {
        const owner_IQ = await u.waitUntil(() => stanzas.filter(
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
        _converse.connection._dataRecv(createRequest(owner_list_stanza));
    }
    return new Promise(resolve => _converse.api.listen.on('membersFetched', resolve));
}

async function receiveOwnMUCPresence (_converse, muc_jid, nick, affiliation='owner', role='moderator', features=[]) {
    const sent_stanzas = _converse.connection.sent_stanzas;
    await u.waitUntil(() => sent_stanzas.filter(iq => sizzle('presence history', iq).length).pop());

    const presence = $pres({
            to: _converse.connection.jid,
            from: `${muc_jid}/${nick}`,
            id: u.getUniqueId()
    }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
        .c('item').attrs({ affiliation, role, 'jid': _converse.bare_jid }).up()
        .c('status').attrs({code:'110'}).up().up()

    if (features.includes(Strophe.NS.OCCUPANTID)) {
        presence.c('occupant-id', {'xmlns': Strophe.NS.OCCUPANTID, 'id': u.getUniqueId() });
    }

    if (_converse.xmppstatus.get('status')) {
       presence.c('show').t(_converse.xmppstatus.get('status'));
    }
    _converse.connection._dataRecv(createRequest(presence));
}

async function openAndEnterChatRoom (
        _converse,
        muc_jid,
        nick,
        features=[],
        members=[],
        force_open=true,
        settings={},
        own_affiliation='owner',
        own_role='moderator',
    ) {
    const { api } = _converse;
    muc_jid = muc_jid.toLowerCase();
    const room_creation_promise = api.rooms.open(muc_jid, settings, force_open);
    await getRoomFeatures(_converse, muc_jid, features);
    await waitForReservedNick(_converse, muc_jid, nick);
    // The user has just entered the room (because join was called)
    // and receives their own presence from the server.
    // See example 24: https://xmpp.org/extensions/xep-0045.html#enter-pres
    await receiveOwnMUCPresence(_converse, muc_jid, nick, own_affiliation, own_role, features);

    await room_creation_promise;
    const model = _converse.chatboxes.get(muc_jid);
    await u.waitUntil(() => (model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));

    const affs = api.settings.get('muc_fetch_members');
    const all_affiliations = Array.isArray(affs) ? affs :  (affs ? ['member', 'admin', 'owner'] : []);

    if (['member', 'admin', 'owner'].includes(own_affiliation)) {
        await returnMemberLists(_converse, muc_jid, members, all_affiliations);
    }
    await model.messages.fetched;
    return model;
}

async function createContact (_converse, name, ask, requesting, subscription) {
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
}

async function createContacts (_converse, type, length) {
    /* Create current (as opposed to requesting or pending) contacts
        * for the user's roster.
        *
        * These contacts are not grouped. See below.
        */
    await _converse.api.waitUntil('rosterContactsFetched');
    let names, subscription, requesting, ask;
    if (type === 'requesting') {
        names = req_names;
        subscription = 'none';
        requesting = true;
        ask = null;
    } else if (type === 'pending') {
        names = pend_names;
        subscription = 'none';
        requesting = false;
        ask = 'subscribe';
    } else if (type === 'current') {
        names = cur_names;
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
}

async function waitForRoster (_converse, type='current', length=-1, include_nick=true, grouped=true) {
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
        ((length > -1) ? pend_names.slice(0, length) : pend_names).map(name =>
            result.c('item', {
                jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                name: include_nick ? name : undefined,
                subscription: 'none',
                ask: 'subscribe'
            }).up()
        );
    }
    if (type === 'current' || type === 'all') {
        const cur_names = Object.keys(current_contacts_map);
        const names = (length > -1) ? cur_names.slice(0, length) : cur_names;
        names.forEach(name => {
            result.c('item', {
                jid: name.replace(/ /g,'.').toLowerCase() + '@montague.lit',
                name: include_nick ? name : undefined,
                subscription: 'both',
                ask: null
            });
            if (grouped) {
                current_contacts_map[name].forEach(g => result.c('group').t(g).up());
            }
            result.up();
        });
    }
    _converse.connection._dataRecv(createRequest(result));
    await _converse.api.waitUntil('rosterContactsFetched');
}

function createChatMessage (_converse, sender_jid, message) {
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

async function sendMessage (view, message) {
    const promise = new Promise(resolve => view.model.messages.once('rendered', resolve));
    const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
    textarea.value = message;
    const message_form = view.querySelector('converse-message-form') || view.querySelector('converse-muc-message-form');
    message_form.onKeyDown({
        target: view.querySelector('textarea.chat-textarea'),
        preventDefault: () => {},
        keyCode: 13
    });
    return promise;
}

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
}

const default_muc_features = [
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

const view_mode = 'overlayed';

// Names from http://www.fakenamegenerator.com/
const req_names = [
    'Escalus, prince of Verona', 'The Nurse', 'Paris'
];
const pend_names = [
    'Lord Capulet', 'Guard', 'Servant'
];
const current_contacts_map = {
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
}

const map = current_contacts_map;
const groups_map = {};
Object.keys(map).forEach(k => {
    const groups = map[k].length ? map[k] : ["Ungrouped"];
    Object.values(groups).forEach(g => {
        groups_map[g] = groups_map[g] ? [...groups_map[g], k] : [k]
    });
});

const cur_names = Object.keys(current_contacts_map);
const num_contacts = req_names.length + pend_names.length + cur_names.length;

const groups = {
    'colleagues': 3,
    'friends & acquaintences': 3,
    'Family': 4,
    'ænemies': 3,
    'Ungrouped': 2
}

const chatroom_names = [
    'Dyon van de Wege',
    'Thomas Kalb',
    'Dirk Theissen',
    'Felix Hofmann',
    'Ka Lek',
    'Anne Ebersbacher'
];

// TODO: need to also test other roles and affiliations
const chatroom_roles = {
    'Anne Ebersbacher': { affiliation: "owner", role: "moderator" },
    'Dirk Theissen': { affiliation: "admin", role: "moderator" },
    'Dyon van de Wege': { affiliation: "member", role: "occupant" },
    'Felix Hofmann': { affiliation: "member", role: "occupant" },
    'Ka Lek': { affiliation: "member", role: "occupant" },
    'Thomas Kalb': { affiliation: "member", role: "occupant" }
}

const event = {
    'preventDefault': function () {}
}

function clearIndexedDB () {
    const promise = u.getOpenPromise();
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

async function _initConverse (settings) {
    clearStores();
    await clearIndexedDB();

    _converse = await converse.initialize(Object.assign({
        'animate': false,
        'auto_subscribe': false,
        'bosh_service_url': 'montague.lit/http-bind',
        'discover_connection_methods': false,
        'enable_smacks': false,
        'i18n': 'en',
        'persistent_store': 'localStorage',
        'loglevel': 'warn',
        'no_trimming': true,
        'play_sounds': false,
        'use_emojione': false,
        'view_mode': view_mode
    }, settings || {}));

    window._converse = _converse;

    _converse.api.vcard.get = function (model, force) {
        let jid;
        if (typeof model === 'string' || model instanceof String) {
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
            'stanza': vcard,
            'fullname': vcard.querySelector('FN')?.textContent,
            'image': vcard.querySelector('PHOTO BINVAL')?.textContent,
            'image_type': vcard.querySelector('PHOTO TYPE')?.textContent,
            'url': vcard.querySelector('URL')?.textContent,
            'vcard_updated': dayjs().format(),
            'vcard_error': undefined
        };
    };
    if (settings?.auto_login !== false) {
        _converse.api.user.login('romeo@montague.lit/orchard', 'secret');
        await _converse.api.waitUntil('afterResourceBinding');
    }
    window.converse_disable_effects = true;
    return _converse;
}


async function deviceListFetched (_converse, jid) {
    const selector = `iq[to="${jid}"] items[node="eu.siacs.conversations.axolotl.devicelist"]`;
    const stanza = await u.waitUntil(
        () => Array.from(_converse.connection.IQ_stanzas).filter(iq => iq.querySelector(selector)).pop()
    );
    await u.waitUntil(() => _converse.devicelists.get(jid));
    return stanza;
}

function ownDeviceHasBeenPublished (_converse) {
    return Array.from(_converse.connection.IQ_stanzas).filter(
        iq => iq.querySelector('iq[from="'+_converse.bare_jid+'"] publish[node="eu.siacs.conversations.axolotl.devicelist"]')
    ).pop();
}

function bundleHasBeenPublished (_converse) {
    const selector = 'publish[node="eu.siacs.conversations.axolotl.bundles:123456789"]';
    return Array.from(_converse.connection.IQ_stanzas).filter(iq => iq.querySelector(selector)).pop();
}

function bundleFetched (_converse, jid, device_id) {
    return Array.from(_converse.connection.IQ_stanzas).filter(
        iq => iq.querySelector(`iq[to="${jid}"] items[node="eu.siacs.conversations.axolotl.bundles:${device_id}"]`)
    ).pop();
}

async function initializedOMEMO (_converse) {
    await waitUntilDiscoConfirmed(
        _converse, _converse.bare_jid,
        [{'category': 'pubsub', 'type': 'pep'}],
        ['http://jabber.org/protocol/pubsub#publish-options']
    );
    let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, _converse.bare_jid));
    let stanza = $iq({
        'from': _converse.bare_jid,
        'id': iq_stanza.getAttribute('id'),
        'to': _converse.bare_jid,
        'type': 'result',
    }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
        .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
            .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                    .c('device', {'id': '482886413b977930064a5888b92134fe'});
    _converse.connection._dataRecv(createRequest(stanza));
    iq_stanza = await u.waitUntil(() => ownDeviceHasBeenPublished(_converse))

    stanza = $iq({
        'from': _converse.bare_jid,
        'id': iq_stanza.getAttribute('id'),
        'to': _converse.bare_jid,
        'type': 'result'});
    _converse.connection._dataRecv(createRequest(stanza));

    iq_stanza = await u.waitUntil(() => bundleHasBeenPublished(_converse))

    stanza = $iq({
        'from': _converse.bare_jid,
        'id': iq_stanza.getAttribute('id'),
        'to': _converse.bare_jid,
        'type': 'result'});
    _converse.connection._dataRecv(createRequest(stanza));
    await _converse.api.waitUntil('OMEMOInitialized');
}

Object.assign(mock, {
    bundleFetched,
    bundleHasBeenPublished,
    chatroom_names,
    chatroom_roles,
    closeAllChatBoxes,
    closeControlBox,
    createChatMessage,
    createContact,
    createContacts,
    createRequest,
    cur_names,
    current_contacts_map,
    default_muc_features,
    deviceListFetched,
    event,
    getRoomFeatures,
    groups,
    groups_map,
    initConverse,
    initializedOMEMO,
    num_contacts,
    openAndEnterChatRoom,
    openChatBoxFor,
    openChatBoxes,
    openChatRoom,
    openChatRoomViaModal,
    openControlBox,
    ownDeviceHasBeenPublished,
    pend_names,
    receiveOwnMUCPresence,
    req_names,
    returnMemberLists,
    sendMessage,
    toggleControlBox,
    view_mode,
    waitForReservedNick,
    waitForRoster,
    waitUntilBookmarksReturned,
    waitUntilDiscoConfirmed
});

window.mock = mock;
