const view_mode = 'overlayed';
const theme = ['dracula', 'classic', 'cyberpunk', 'nordic'][Math.floor(Math.random() * 4)];

let originalVCardGet;
let _converse;

export const chatroom_names = [
    'Dyon van de Wege',
    'Thomas Kalb',
    'Dirk Theissen',
    'Felix Hofmann',
    'Ka Lek',
    'Anne Ebersbacher',
];

export const default_muc_features = [
    'http://jabber.org/protocol/muc',
    'jabber:iq:register',
    'urn:xmpp:mam:2',
    'urn:xmpp:sid:0',
    'muc_passwordprotected',
    'muc_hidden',
    'muc_temporary',
    'muc_open',
    'muc_unmoderated',
    'muc_anonymous',
];

jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000;

jasmine.toEqualStanza = function toEqualStanza() {
    return {
        compare(actual, expected) {
            const { u } = window.converse.env;
            const result = { pass: u.isEqualNode(actual, expected) };
            if (!result.pass) {
                result.message =
                    `Stanzas don't match:\n` +
                    `Actual:\n${(actual.tree?.() ?? actual).outerHTML}\n` +
                    `Expected:\n${expected.tree().outerHTML}`;
            }
            return result;
        },
    };
};

export const domain = 'montague.lit';

export const current_contacts_map = {
    'Mercutio': ['Colleagues', 'friends & acquaintances'],
    'Juliet Capulet': ['friends & acquaintances'],
    'Lady Montague': ['Colleagues', 'Family'],
    'Lord Montague': ['Family'],
    'Friar Laurence': ['friends & acquaintances'],
    'Tybalt': ['friends & acquaintances'],
    'Lady Capulet': ['ænemies'],
    'Benviolo': ['friends & acquaintances'],
    'Balthasar': ['Colleagues'],
    'Peter': ['Colleagues'],
    'Abram': ['Colleagues'],
    'Sampson': ['Colleagues'],
    'Gregory': ['friends & acquaintances'],
    'Potpan': [],
    'Friar John': [],
};
export const req_names = ['Escalus, prince of Verona', 'The Nurse', 'Paris'];
export const pend_names = ['Lord Capulet', 'Guard', 'Servant'];
export const cur_names = Object.keys(current_contacts_map);

export async function waitForRoster(_converse, type = 'current', length = -1, include_nick = true, grouped = true) {
    const { u, sizzle } = window.converse.env;
    const s = `iq[type="get"] query[xmlns="${Strophe.NS.ROSTER}"]`;
    const iq = await u.waitUntil(() =>
        _converse.api.connection
            .get()
            .IQ_stanzas.filter((iq) => sizzle(s, iq).length)
            .pop()
    );

    const result = $iq({
        'to': _converse.api.connection.get().jid,
        'type': 'result',
        'id': iq.getAttribute('id'),
    }).c('query', {
        'xmlns': 'jabber:iq:roster',
    });
    if (type === 'pending' || type === 'all') {
        (length > -1 ? pend_names.slice(0, length) : pend_names).map((name) =>
            result
                .c('item', {
                    jid: `${name.replace(/ /g, '.').toLowerCase()}@${domain}`,
                    name: include_nick ? name : undefined,
                    subscription: 'none',
                    ask: 'subscribe',
                })
                .up()
        );
    }
    if (type === 'current' || type === 'all') {
        const cur_names = Object.keys(current_contacts_map);
        const names = length > -1 ? cur_names.slice(0, length) : cur_names;
        names.forEach((name) => {
            result.c('item', {
                jid: `${name.replace(/ /g, '.').toLowerCase()}@${domain}`,
                name: include_nick ? name : undefined,
                subscription: 'both',
                ask: null,
            });
            if (grouped) {
                current_contacts_map[name].forEach((g) => result.c('group').t(g).up());
            }
            result.up();
        });
    }
    _converse.api.connection.get()._dataRecv(createRequest(result));
    await _converse.api.waitUntil('rosterContactsFetched');
}

export async function waitUntilDiscoConfirmed(
    _converse,
    entity_jid,
    identities,
    features = [],
    items = [],
    type = 'info'
) {
    const { u, sizzle } = window.converse.env;
    const sel = `iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#${type}"]`;
    const iq = await u.waitUntil(() => _converse.api.connection.get().IQ_stanzas.find((iq) => sizzle(sel, iq).length));
    const stanza = stx`
            <iq type="result"
                from="${entity_jid}"
                to="${_converse.session.get('jid')}"
                id="${iq.getAttribute('id')}"
                xmlns="jabber:client">
            <query xmlns="http://jabber.org/protocol/disco#${type}">
                ${identities?.map((identity) => stx`<identity category="${identity.category}" type="${identity.type}"></identity>`)}
                ${features?.map((feature) => stx`<feature var="${feature}"></feature>`)}
                ${items?.map((item) => stx`<item jid="${item}"></item>`)}
            </query>
            </iq>`;
    _converse.api.connection.get()._dataRecv(createRequest(stanza));
}

/**
 * Returns an item-not-found disco info result, simulating that this was a
 * new MUC being entered.
 */
export async function waitForNewMUCDiscoInfo(_converse, muc_jid) {
    const { u } = window.converse.env;
    const { api } = _converse;
    const connection = api.connection.get();
    const own_jid = connection.jid;
    const stanzas = connection.IQ_stanzas;
    const stanza = await u.waitUntil(() =>
        stanzas
            .filter((iq) =>
                iq.querySelector(`iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`)
            )
            .pop()
    );
    const features_stanza = stx`<iq from="${muc_jid}"
                id="${stanza.getAttribute('id')}"
                to="${own_jid}"
                type="error"
                xmlns="jabber:client">
            <error type="cancel">
                <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
            </error>
        </iq>`;
    _converse.api.connection.get()._dataRecv(createRequest(features_stanza));
}

export async function waitUntilBookmarksReturned(
    _converse,
    bookmarks = [],
    features = [
        'http://jabber.org/protocol/pubsub#publish-options',
        'http://jabber.org/protocol/pubsub#config-node-max',
        'urn:xmpp:bookmarks:1#compat',
    ],
    node = 'urn:xmpp:bookmarks:1'
) {
    const { u, sizzle } = window.converse.env;
    await waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [{ 'category': 'pubsub', 'type': 'pep' }], features);
    const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
    const sent_stanza = await u.waitUntil(() =>
        IQ_stanzas.filter((s) => sizzle(`items[node="${node}"]`, s).length).pop()
    );

    let stanza;
    if (node === 'storage:bookmarks') {
        stanza = stx`
            <iq to="${_converse.api.connection.get().jid}"
                type="result"
                id="${sent_stanza.getAttribute('id')}"
                xmlns="jabber:client">
            <pubsub xmlns="${Strophe.NS.PUBSUB}">
                <items node="storage:bookmarks">
                    <item id="current">
                        <storage xmlns="storage:bookmarks">
                        </storage>
                    </item>
                    ${bookmarks.map(
                        (b) => stx`
                        <conference name="${b.name}" autojoin="${b.autojoin}" jid="${b.jid}">
                            ${b.nick ? stx`<nick>${b.nick}</nick>` : ''}
                        </conference>`
                    )}
                </items>
            </pubsub>
            </iq>`;
    } else {
        stanza = stx`
            <iq type="result"
                to="${_converse.jid}"
                id="${sent_stanza.getAttribute('id')}"
                xmlns="jabber:client">
            <pubsub xmlns="${Strophe.NS.PUBSUB}">
                <items node="urn:xmpp:bookmarks:1">
                ${bookmarks.map(
                    (b) => stx`
                    <item id="${b.jid}">
                        <conference xmlns="urn:xmpp:bookmarks:1"
                                    name="${b.name}"
                                    autojoin="${b.autojoin ?? false}">
                            ${b.nick ? stx`<nick>${b.nick}</nick>` : ''}
                            ${b.password ? stx`<password>${b.password}</password>` : ''}
                        </conference>
                    </item>`
                )};
                </items>
            </pubsub>
            </iq>`;
    }

    _converse.api.connection.get()._dataRecv(createRequest(stanza));
    await _converse.api.waitUntil('bookmarksInitialized');
}

export async function receiveOwnMUCPresence(
    _converse,
    muc_jid,
    nick,
    affiliation = 'owner',
    role = 'moderator',
    features = []
) {
    const { u } = window.converse.env;
    const sent_stanzas = _converse.api.connection.get().sent_stanzas;
    await u.waitUntil(
        () =>
            sent_stanzas.filter((s) => s.nodeName === 'presence' && s.getAttribute('to') === `${muc_jid}/${nick}`)
                .length
    );

    _converse.api.connection.get()._dataRecv(
        createRequest(stx`
        <presence xmlns="jabber:client"
                to="${_converse.api.connection.get().jid}"
                from="${muc_jid}/${nick}"
                id="${u.getUniqueId()}">
            <x xmlns="http://jabber.org/protocol/muc#user">
                <item affiliation="${affiliation}" role="${role}" jid="${_converse.bare_jid}"/>
                <status code="110"/>
            </x>
            ${
                features.includes(Strophe.NS.OCCUPANTID)
                    ? stx`<occupant-id xmlns="${Strophe.NS.OCCUPANTID}" id="${u.getUniqueId()}"/>`
                    : ''
            }
            ${_converse.state.profile.get('show') ? stx`<show>${_converse.state.profile.get('show')}</show>` : ''}
        </presence>`)
    );
}

export async function waitForReservedNick(_converse, muc_jid, nick) {
    const { u, sizzle } = window.converse.env;
    const stanzas = _converse.api.connection.get().IQ_stanzas;
    const selector = `iq[to="${muc_jid.toLowerCase()}"] query[node="x-roomuser-item"]`;
    const iq = await u.waitUntil(() => stanzas.filter((s) => sizzle(selector, s).length).pop());

    // We remove the stanza, otherwise we might get stale stanzas returned in our filter above.
    stanzas.splice(stanzas.indexOf(iq), 1);

    // The XMPP server returns the reserved nick for this user.
    const IQ_id = iq.getAttribute('id');
    const stanza = $iq({
        'type': 'result',
        'id': IQ_id,
        'from': muc_jid,
        'to': _converse.api.connection.get().jid,
    }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info', 'node': 'x-roomuser-item' });
    if (nick) {
        stanza.c('identity', { 'category': 'conference', 'name': nick, 'type': 'text' });
    }
    _converse.api.connection.get()._dataRecv(createRequest(stanza));
    if (nick) {
        return u.waitUntil(() => nick);
    }
}

export async function waitForMUCDiscoInfo(_converse, muc_jid, features = [], settings = {}) {
    const { u, Strophe } = window.converse.env;

    const room = Strophe.getNodeFromJid(muc_jid);
    muc_jid = muc_jid.toLowerCase();
    const stanzas = _converse.api.connection.get().IQ_stanzas;
    const stanza = await u.waitUntil(() =>
        stanzas
            .filter((iq) =>
                iq.querySelector(`iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`)
            )
            .pop()
    );
    features = features.length ? features : default_muc_features;

    const features_stanza = stx`
        <iq from="${muc_jid}"
            id="${stanza.getAttribute('id')}"
            to="romeo@montague.lit/desktop"
            type="result"
            xmlns="jabber:client">
            <query xmlns="http://jabber.org/protocol/disco#info">
                <identity category="conference"
                          name="${settings.name ?? `${room[0].toUpperCase()}${room.slice(1)}`}"
                          type="text"/>
                ${features.map((f) => stx`<feature var="${f}"></feature>`)}
            </query>
            <x xmlns="jabber:x:data" type="result">
                <field var="FORM_TYPE" type="hidden"><value>http://jabber.org/protocol/muc#roominfo</value></field>
                <field var="muc#roominfo_description" type="text-single" label="Description"><value>This is the description</value></field>
                <field var="muc#roominfo_occupants" type="text-single" label="Number of occupants"><value>0</value></field>
            </x>
        </iq>`;
    _converse.api.connection.get()._dataRecv(createRequest(features_stanza));
}

export async function returnMemberLists(_converse, muc_jid, members = [], affiliations = ['member', 'owner', 'admin']) {
    if (affiliations.length === 0) {
        return;
    }
    const { u, sizzle } = window.converse.env;
    const stanzas = _converse.api.connection.get().IQ_stanzas;

    if (affiliations.includes('member')) {
        const member_IQ = await u.waitUntil(() =>
            stanzas
                .filter(
                    (s) =>
                        sizzle(
                            `iq[to="${muc_jid}"] query[xmlns="${Strophe.NS.MUC_ADMIN}"] item[affiliation="member"]`,
                            s
                        ).length
                )
                .pop()
        );
        const member_list_stanza = $iq({
            'from': 'coven@chat.shakespeare.lit',
            'id': member_IQ.getAttribute('id'),
            'to': 'romeo@montague.lit/orchard',
            'type': 'result',
        }).c('query', { 'xmlns': Strophe.NS.MUC_ADMIN });
        members
            .filter((m) => m.affiliation === 'member')
            .forEach((m) => {
                member_list_stanza.c('item', {
                    'affiliation': m.affiliation,
                    'jid': m.jid,
                    'nick': m.nick,
                });
            });
        _converse.api.connection.get()._dataRecv(createRequest(member_list_stanza));
    }

    if (affiliations.includes('admin')) {
        const admin_IQ = await u.waitUntil(() =>
            stanzas
                .filter(
                    (s) =>
                        sizzle(
                            `iq[to="${muc_jid}"] query[xmlns="${Strophe.NS.MUC_ADMIN}"] item[affiliation="admin"]`,
                            s
                        ).length
                )
                .pop()
        );
        const admin_list_stanza = $iq({
            'from': 'coven@chat.shakespeare.lit',
            'id': admin_IQ.getAttribute('id'),
            'to': 'romeo@montague.lit/orchard',
            'type': 'result',
        }).c('query', { 'xmlns': Strophe.NS.MUC_ADMIN });
        members
            .filter((m) => m.affiliation === 'admin')
            .forEach((m) => {
                admin_list_stanza.c('item', {
                    'affiliation': m.affiliation,
                    'jid': m.jid,
                    'nick': m.nick,
                });
            });
        _converse.api.connection.get()._dataRecv(createRequest(admin_list_stanza));
    }

    if (affiliations.includes('owner')) {
        const owner_IQ = await u.waitUntil(() =>
            stanzas
                .filter(
                    (s) =>
                        sizzle(
                            `iq[to="${muc_jid}"] query[xmlns="${Strophe.NS.MUC_ADMIN}"] item[affiliation="owner"]`,
                            s
                        ).length
                )
                .pop()
        );
        const owner_list_stanza = $iq({
            'from': 'coven@chat.shakespeare.lit',
            'id': owner_IQ.getAttribute('id'),
            'to': 'romeo@montague.lit/orchard',
            'type': 'result',
        }).c('query', { 'xmlns': Strophe.NS.MUC_ADMIN });
        members
            .filter((m) => m.affiliation === 'owner')
            .forEach((m) => {
                owner_list_stanza.c('item', {
                    'affiliation': m.affiliation,
                    'jid': m.jid,
                    'nick': m.nick,
                });
            });
        _converse.api.connection.get()._dataRecv(createRequest(owner_list_stanza));
    }
    return new Promise((resolve) => _converse.api.listen.on('membersFetched', resolve));
}

export async function openAndEnterMUC(
    _converse,
    muc_jid,
    nick,
    features = [],
    members = [],
    force_open = true,
    settings = {},
    own_affiliation = 'owner',
    own_role = 'moderator'
) {
    const { u } = window.converse.env;
    const { api } = _converse;
    muc_jid = muc_jid.toLowerCase();

    const room_creation_promise = api.rooms.open(muc_jid, settings, force_open);
    await waitForMUCDiscoInfo(_converse, muc_jid, features, settings);
    await waitForReservedNick(_converse, muc_jid, nick);
    // The user has just entered the room (because join was called)
    // and receives their own presence from the server.
    // See example 24: https://xmpp.org/extensions/xep-0045.html#enter-pres
    await receiveOwnMUCPresence(_converse, muc_jid, nick, own_affiliation, own_role, features);

    await room_creation_promise;
    const model = _converse.chatboxes.get(muc_jid);
    await u.waitUntil(() => model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED);

    const affs = api.settings.get('muc_fetch_members');
    const all_affiliations = Array.isArray(affs) ? affs : affs ? ['member', 'admin', 'owner'] : [];

    if (['member', 'admin', 'owner'].includes(own_affiliation)) {
        await returnMemberLists(_converse, muc_jid, members, all_affiliations);
    }
    await model.messages.fetched;
    return model;
}

async function openChatBoxFor(_converse, jid) {
    await _converse.api.waitUntil('rosterContactsFetched');
    return _converse.roster.get(jid).openChat();
}

export function createChatMessage(_converse, sender_jid, message, type = 'chat') {
    return $msg({
        from: sender_jid,
        to: _converse.api.connection.get().jid,
        type,
        id: new Date().getTime(),
    })
        .c('body')
        .t(message)
        .up()
        .c('markable', { 'xmlns': Strophe.NS.MARKERS })
        .up()
        .c('active', { 'xmlns': Strophe.NS.CHATSTATES })
        .tree();
}

function getMockVcardFetcher(settings) {
    const { dayjs } = window.converse.env;
    return (model, force) => {
        let jid;
        if (typeof model === 'string' || model instanceof String) {
            jid = model;
        } else if (!model.get('vcard_updated') || force) {
            jid = model.get('jid') || model.get('muc_jid');
        }

        let fullname;
        let nickname;
        if (!jid || jid == 'romeo@montague.lit') {
            jid = settings?.vcard?.jid ?? 'romeo@montague.lit';
            fullname = settings?.vcard?.display_name ?? 'Romeo Montague';
            nickname = settings?.vcard?.nickname ?? 'Romeo';
        } else {
            const name = jid.split('@')[0].replace(/\./g, ' ').split(' ');
            const last = name.length - 1;
            name[0] = name[0].charAt(0).toUpperCase() + name[0].slice(1);
            name[last] = name[last].charAt(0).toUpperCase() + name[last].slice(1);
            fullname = name.join(' ');
        }
        const vcard = $iq().c('vCard').c('FN').t(fullname).up();
        if (nickname) vcard.c('NICKNAME').t(nickname);
        const vcard_el = vcard.tree();

        return Promise.resolve({
            stanza: vcard_el,
            fullname: vcard_el.querySelector('FN')?.textContent,
            nickname: vcard_el.querySelector('NICKNAME')?.textContent,
            image: vcard_el.querySelector('PHOTO BINVAL')?.textContent,
            image_type: vcard_el.querySelector('PHOTO TYPE')?.textContent,
            url: vcard_el.querySelector('URL')?.textContent,
            vcard_updated: dayjs().format(),
            vcard_error: undefined,
        });
    };
}

function clearIndexedDB() {
    const { u } = window.converse.env;
    const promise = u.getOpenPromise();
    const db_request = window.indexedDB.open('converse-test-persistent');
    db_request.onsuccess = function () {
        const db = db_request.result;
        const bare_jid = 'romeo@montague.lit';
        let store;
        try {
            store = db.transaction([bare_jid], 'readwrite').objectStore(bare_jid);
        } catch (e) {
            return promise.resolve();
        }
        const request = store.clear();
        request.onsuccess = promise.resolve();
        request.onerror = promise.resolve();
    };
    db_request.onerror = function (ev) {
        return promise.reject(ev.target.error);
    };
    return promise;
}

function clearStores() {
    [localStorage, sessionStorage].forEach((s) =>
        Object.keys(s).forEach((k) => k.match(/^converse-test-/) && s.removeItem(k))
    );
    const cache_key = `converse.room-bookmarksromeo@montague.lit`;
    window.sessionStorage.removeItem(cache_key + 'fetched');
}

export function createRequest(stanza) {
    stanza = typeof stanza.tree == 'function' ? stanza.tree() : stanza;
    const req = new Strophe.Request(stanza, () => {});
    req.getResponse = function () {
        var env = new Strophe.Builder('env', { type: 'mock' }).tree();
        env.appendChild(stanza);
        return env;
    };
    return req;
}

async function _initConverse(converse, settings) {
    clearStores();
    await clearIndexedDB();

    _converse = await converse.initialize(
        Object.assign(
            {
                animate: false,
                auto_subscribe: false,
                bosh_service_url: 'montague.lit/http-bind',
                disable_effects: true,
                discover_connection_methods: false,
                embed_3rd_party_media_players: false,
                enable_smacks: false,
                fetch_url_headers: false,
                i18n: 'en',
                loglevel: window.location.pathname === '/debug.html' ? 'debug' : 'error',
                no_trimming: true,
                persistent_store: 'localStorage',
                play_sounds: false,
                theme,
                use_emojione: false,
                view_mode,
            },
            settings || {}
        )
    );

    window._converse = _converse;

    originalVCardGet = originalVCardGet || _converse.api.vcard.get;

    if (!settings?.no_vcard_mocks && _converse.api.vcard) {
        _converse.api.vcard.get = getMockVcardFetcher(settings);
    } else {
        _converse.api.vcard.get = originalVCardGet;
    }

    if (settings?.auto_login !== false) {
        await _converse.api.user.login('romeo@montague.lit/orchard', 'secret');
    }
    return _converse;
}

export function initConverse(promise_names = [], settings = null, func) {
    if (typeof promise_names === 'function') {
        func = promise_names;
        promise_names = [];
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
        document.title = 'Converse Tests';

        await _initConverse(window.converse, settings);
        await Promise.all((promise_names || []).map(_converse.api.waitUntil));

        // eslint-disable-next-line max-len
        _converse.default_avatar_image =
            'PD94bWwgdmVyc2lvbj0iMS4wIj8+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiA8cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzU1NSIvPgogPGNpcmNsZSBjeD0iNjQiIGN5PSI0MSIgcj0iMjQiIGZpbGw9IiNmZmYiLz4KIDxwYXRoIGQ9Im0yOC41IDExMiB2LTEyIGMwLTEyIDEwLTI0IDI0LTI0IGgyMyBjMTQgMCAyNCAxMiAyNCAyNCB2MTIiIGZpbGw9IiNmZmYiLz4KPC9zdmc+Cg==';
        _converse.default_avatar_image_type = 'image/svg+xml';

        try {
            await func(_converse);
        } catch (e) {
            console.error(e);
            fail(e);
        }
    };
}

export default {
    chatroom_names,
    createChatMessage,
    createRequest,
    cur_names,
    default_muc_features,
    initConverse,
    openAndEnterMUC,
    openChatBoxFor,
    receiveOwnMUCPresence,
    returnMemberLists,
    waitForMUCDiscoInfo,
    waitForNewMUCDiscoInfo,
    waitForReservedNick,
    waitForRoster,
    waitUntilBookmarksReturned,
    waitUntilDiscoConfirmed,
};
