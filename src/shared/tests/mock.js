import {
    chatroom_names,
    createChatMessage,
    createRequest,
    cur_names,
    current_contacts_map,
    default_muc_features,
    domain,
    initConverse,
    openAndEnterMUC,
    pend_names,
    receiveOwnMUCPresence,
    req_names,
    returnMemberLists,
    waitForMUCDiscoInfo,
    waitForNewMUCDiscoInfo,
    waitForReservedNick,
    waitForRoster,
    waitUntilBookmarksReturned,
    waitUntilDiscoConfirmed,
} from '../../headless/tests/mock.js';

const mock = {};
const converse = window.converse;
converse.load();
const { u, $iq } = converse.env;

function getContactJID(index) {
    return mock.cur_names[index].replace(/ /g,'.').toLowerCase() + '@montague.lit';
}

async function checkHeaderToggling(group) {
    const toggle = group.querySelector('a.group-toggle');
    expect(u.isVisible(group)).toBeTruthy();
    expect(group.querySelectorAll('ul.collapsed').length).toBe(0);
    expect(u.hasClass('fa-caret-right', toggle.firstElementChild)).toBeFalsy();
    expect(u.hasClass('fa-caret-down', toggle.firstElementChild)).toBeTruthy();
    toggle.click();

    await u.waitUntil(() => group.querySelectorAll('ul.collapsed').length === 1);
    expect(u.hasClass('fa-caret-right', toggle.firstElementChild)).toBeTruthy();
    expect(u.hasClass('fa-caret-down', toggle.firstElementChild)).toBeFalsy();
    toggle.click();
    await u.waitUntil(() => group.querySelectorAll('li .open-chat').length ===
        Array.from(group.querySelectorAll('li .open-chat')).filter(u.isVisible).length);

    expect(u.hasClass('fa-caret-right', toggle.firstElementChild)).toBeFalsy();
    expect(u.hasClass('fa-caret-down', toggle.firstElementChild)).toBeTruthy();
};

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
    return model;
}

function closeControlBox () {
    const view = document.querySelector("#controlbox");
    u.isVisible(view) && view.querySelector(".controlbox-heading__btn.close")?.click();
}

async function waitUntilBlocklistInitialized (_converse, blocklist=[]) {
    window.sessionStorage.removeItem('converse.blocklist-romeo@montague.lit-fetched');

    const { api } = _converse;
    await waitUntilDiscoConfirmed(
        _converse,
        _converse.domain,
        [{ 'category': 'server', 'type': 'IM' }],
        ['urn:xmpp:blocking']
    );
    const connection = api.connection.get();
    const IQ_stanzas = connection.IQ_stanzas;
    const sent_stanza = await u.waitUntil(() => IQ_stanzas.find((s) => s.querySelector('iq blocklist')));

    connection._dataRecv(mock.createRequest(stx`
            <iq xmlns="jabber:client"
                to="${connection.jid}"
                type="result"
                id="${sent_stanza.getAttribute('id')}">
            <blocklist xmlns='urn:xmpp:blocking'>
                ${blocklist.map((jid) => stx`<item jid='${jid}'/>`)}
            </blocklist>
        </iq>`));

    return await api.waitUntil('blocklistInitialized');
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

async function openAddMUCModal (_converse) {
    await mock.openControlBox(_converse);
    const controlbox = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
    controlbox.querySelector('converse-rooms-list .show-add-muc-modal').click();
    const modal = _converse.api.modal.get('converse-add-muc-modal');
    await u.waitUntil(() => u.isVisible(modal), 1000);
    return modal;
}

async function createContact (_converse, name, ask, requesting, subscription) {
    const jid = name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
    if (_converse.roster.get(jid)) {
        return Promise.resolve();
    }
    const contact = await new Promise((success, error) => {
        _converse.roster.create({
            'fullname': name,
            ask,
            jid,
            requesting,
            subscription,
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


async function sendMessage (view, message) {
    const promise = new Promise(resolve => view.model.messages.once('rendered', resolve));
    const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
    textarea.value = message;
    const message_form = view.querySelector('converse-message-form') || view.querySelector('converse-muc-message-form');
    message_form.onKeyDown({
        target: view.querySelector('textarea.chat-textarea'),
        preventDefault: () => {},
        key: "Enter",
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


const map = current_contacts_map;
const groups_map = {};
Object.keys(map).forEach(k => {
    const groups = map[k].length ? map[k] : ["Ungrouped"];
    Object.values(groups).forEach(g => {
        groups_map[g] = groups_map[g] ? [...groups_map[g], k] : [k]
    });
});

const num_contacts = req_names.length + pend_names.length + cur_names.length;

const req_jids = req_names.map((name) => `${name.replace(/ /g, '.').toLowerCase()}@${domain}`);
const cur_jids = cur_names.map((name) => `${name.replace(/ /g, '.').toLowerCase()}@${domain}`);

const groups = {
    'colleagues': 3,
    'friends & acquaintances': 3,
    'Family': 4,
    'ænemies': 3,
    'Ungrouped': 2
}


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

async function deviceListFetched (_converse, jid, device_ids) {
    const selector = `iq[to="${jid}"] items[node="eu.siacs.conversations.axolotl.devicelist"]`;
    const iq_stanza = await u.waitUntil(
        () => Array.from(_converse.api.connection.get().IQ_stanzas).filter(iq => iq.querySelector(selector)).pop()
    );
    await u.waitUntil(() => _converse.state.devicelists.get(jid));
    if (Array.isArray(device_ids)) {
        const stanza = stx`<iq from="${jid}"
                            xmlns="jabber:server"
                            id="${iq_stanza.getAttribute('id')}"
                            to="${_converse.api.connection.get().jid}"
                            type="result">
            <pubsub xmlns="http://jabber.org/protocol/pubsub">
                <items node="eu.siacs.conversations.axolotl.devicelist">
                    <item xmlns="http://jabber.org/protocol/pubsub">
                        <list xmlns="eu.siacs.conversations.axolotl">
                            ${device_ids.map((id) => stx`<device id="${id}"/>`)}
                        </list>
                    </item>
                </items>
            </pubsub>
        </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
    }
    return iq_stanza;
}

function ownDeviceHasBeenPublished (_converse) {
    return Array.from(_converse.api.connection.get().IQ_stanzas).filter(
        iq => iq.querySelector('iq[from="'+_converse.bare_jid+'"] publish[node="eu.siacs.conversations.axolotl.devicelist"]')
    ).pop();
}

function bundleHasBeenPublished (_converse) {
    const selector = 'publish[node="eu.siacs.conversations.axolotl.bundles:123456789"]';
    return Array.from(_converse.api.connection.get().IQ_stanzas).filter(iq => iq.querySelector(selector)).pop();
}

function bundleIQRequestSent(_converse, jid, device_id) {
    return Array.from(_converse.api.connection.get().IQ_stanzas).filter(
        iq => iq.querySelector(`iq[to="${jid}"] items[node="eu.siacs.conversations.axolotl.bundles:${device_id}"]`)
    ).pop();
}

async function bundleFetched(
    _converse,
    {
        jid,
        device_id,
        identity_key,
        signed_prekey_id,
        signed_prekey_public,
        signed_prekey_sig,
        prekeys,
    }
) {
    const iq_stanza = await u.waitUntil(() => bundleIQRequestSent(_converse, jid, device_id));
    const stanza = stx`<iq from="${jid}"
            id="${iq_stanza.getAttribute("id")}"
            to="${_converse.bare_jid}"
            xmlns="jabber:server"
            type="result">
        <pubsub xmlns="http://jabber.org/protocol/pubsub">
            <items node="eu.siacs.conversations.axolotl.bundles:${device_id}">
                <item>
                    <bundle xmlns="eu.siacs.conversations.axolotl">
                        <signedPreKeyPublic signedPreKeyId="${signed_prekey_id}">${btoa(signed_prekey_public)}</signedPreKeyPublic>
                        <signedPreKeySignature>${btoa(signed_prekey_sig)}</signedPreKeySignature>
                        <identityKey>${btoa(identity_key)}</identityKey>
                        <prekeys>
                            ${prekeys.map((k, i) => stx`<preKeyPublic preKeyId="${i}">${btoa(k)}</preKeyPublic>`)}
                        </prekeys>
                    </bundle>
                </item>
            </items>
        </pubsub>
    </iq>`;
    _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
}

async function initializedOMEMO(
    _converse,
    identities = [{ 'category': 'pubsub', 'type': 'pep' }],
    features = ['http://jabber.org/protocol/pubsub#publish-options']
) {
    await waitUntilDiscoConfirmed(_converse, _converse.bare_jid, identities, features);
    await deviceListFetched(_converse, _converse.bare_jid, ['482886413b977930064a5888b92134fe']);
    let iq_stanza = await u.waitUntil(() => ownDeviceHasBeenPublished(_converse));

    let stanza = $iq({
        'from': _converse.bare_jid,
        'id': iq_stanza.getAttribute('id'),
        'to': _converse.bare_jid,
        'type': 'result',
    });
    _converse.api.connection.get()._dataRecv(createRequest(stanza));

    iq_stanza = await u.waitUntil(() => bundleHasBeenPublished(_converse));

    stanza = $iq({
        'from': _converse.bare_jid,
        'id': iq_stanza.getAttribute('id'),
        'to': _converse.bare_jid,
        'type': 'result',
    });
    _converse.api.connection.get()._dataRecv(createRequest(stanza));
    await _converse.api.waitUntil('OMEMOInitialized');
}

Object.assign(mock, {
    bundleFetched,
    bundleHasBeenPublished,
    bundleIQRequestSent,
    chatroom_names,
    chatroom_roles,
    checkHeaderToggling,
    closeAllChatBoxes,
    closeControlBox,
    createChatMessage,
    createContact,
    createContacts,
    createRequest,
    cur_jids,
    cur_names,
    current_contacts_map,
    default_muc_features,
    deviceListFetched,
    event,
    getContactJID,
    groups,
    groups_map,
    initConverse,
    initializedOMEMO,
    num_contacts,
    openAddMUCModal,
    openAndEnterMUC,
    openChatBoxFor,
    openChatBoxes,
    openControlBox,
    ownDeviceHasBeenPublished,
    pend_names,
    receiveOwnMUCPresence,
    req_jids,
    req_names,
    returnMemberLists,
    sendMessage,
    toggleControlBox,
    waitForMUCDiscoInfo,
    waitForNewMUCDiscoInfo,
    waitForReservedNick,
    waitForRoster,
    waitUntilBlocklistInitialized,
    waitUntilBookmarksReturned,
    waitUntilDiscoConfirmed
});

window.mock = mock;
