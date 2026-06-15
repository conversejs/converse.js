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

function getContactJID(index) {
    return cur_names[index].replace(/ /g, '.').toLowerCase() + '@montague.lit';
}

async function checkHeaderToggling(_converse, group) {
    const { u } = _converse.env;
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
    await u.waitUntil(
        () =>
            group.querySelectorAll('li .open-chat').length ===
            Array.from(group.querySelectorAll('li .open-chat')).filter(u.isVisible).length,
    );

    expect(u.hasClass('fa-caret-right', toggle.firstElementChild)).toBeFalsy();
    expect(u.hasClass('fa-caret-down', toggle.firstElementChild)).toBeTruthy();
}

function closeAllChatBoxes(_converse) {
    return Promise.all(_converse.chatboxviews.map((view) => view.close()));
}

function toggleControlBox(_converse) {
    const { u } = _converse.env;
    const toggle = document.querySelector('.toggle-controlbox');
    if (!u.isVisible(document.querySelector('#controlbox'))) {
        if (!u.isVisible(toggle)) {
            u.removeClass('hidden', toggle);
        }
        toggle.click();
    }
}

async function openControlBox(_converse) {
    const { u } = _converse.env;
    const model = await _converse.api.controlbox.open();
    await u.waitUntil(() => model.get('connected'));
    toggleControlBox(_converse);
    return model;
}

function closeControlBox(_converse) {
    const { u } = _converse.env;
    const view = document.querySelector('#controlbox');
    if (u.isVisible(view)) view.querySelector('.controlbox-heading__btn.close')?.click();
}

async function waitUntilBlocklistInitialized(_converse, blocklist = []) {
    window.sessionStorage.removeItem('converse.blocklist-romeo@montague.lit-fetched');

    const { api } = _converse;
    const { stx, u } = _converse.env;
    await waitUntilDiscoConfirmed(
        _converse,
        _converse.domain,
        [{ 'category': 'server', 'type': 'IM' }],
        ['urn:xmpp:blocking'],
    );
    const connection = api.connection.get();
    const IQ_stanzas = connection.IQ_stanzas;
    const sent_stanza = await u.waitUntil(() => IQ_stanzas.find((s) => s.querySelector('iq blocklist')));

    connection._dataRecv(
        createRequest(
            _converse,
            stx`
            <iq xmlns="jabber:client"
                to="${connection.jid}"
                type="result"
                id="${sent_stanza.getAttribute('id')}">
            <blocklist xmlns='urn:xmpp:blocking'>
                ${blocklist.map((jid) => stx`<item jid='${jid}'/>`)}
            </blocklist>
        </iq>`,
        ),
    );

    return await api.waitUntil('blocklistInitialized');
}

function openChatBoxes(_converse, amount) {
    for (let i = 0; i < amount; i++) {
        const jid = cur_names[i].replace(/ /g, '.').toLowerCase() + '@montague.lit';
        _converse.roster.get(jid).openChat();
    }
}

async function openChatBoxFor(_converse, jid) {
    const { u } = _converse.env;
    await _converse.api.waitUntil('rosterContactsFetched');
    _converse.roster.get(jid).openChat();
    return u.waitUntil(() => _converse.chatboxviews.get(jid), 1000);
}

async function openAddMUCModal(_converse) {
    const { u } = _converse.env;
    await openControlBox(_converse);
    const controlbox = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
    controlbox.querySelector('converse-rooms-list .show-add-muc-modal').click();
    const modal = _converse.api.modal.get('converse-add-muc-modal');
    await u.waitUntil(() => u.isVisible(modal), 1000);
    return modal;
}

async function createContact(_converse, name, ask, requesting, subscription) {
    const jid = name.replace(/ /g, '.').toLowerCase() + '@montague.lit';
    if (_converse.roster.get(jid)) {
        return Promise.resolve();
    }
    const contact = await new Promise((success, error) => {
        _converse.roster.create(
            {
                'fullname': name,
                ask,
                jid,
                requesting,
                subscription,
            },
            { success, error },
        );
    });
    return contact;
}

async function createContacts(_converse, type, length) {
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
        await this.createContacts(_converse, 'requesting');
        await this.createContacts(_converse, 'pending');
        return this;
    } else {
        throw Error('Need to specify the type of contact to create');
    }
    const promises = names.slice(0, length).map((n) => this.createContact(_converse, n, ask, requesting, subscription));
    await Promise.all(promises);
}

async function sendMessage(_converse, view, message) {
    const { u } = _converse.env;
    const promise = new Promise((resolve) => view.model.messages.once('rendered', resolve));
    const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
    textarea.value = message;
    const message_form = view.querySelector('converse-message-form') || view.querySelector('converse-muc-message-form');
    message_form.onKeyDown({
        target: view.querySelector('textarea.chat-textarea'),
        preventDefault: () => {},
        key: 'Enter',
    });
    return promise;
}

window.libomemo = {
    'OMEMOAddress': function (name, device_id) {
        this.name = name;
        this.deviceId = device_id;
    },
};
window.libomemo.OMEMOAddress.fromString = function (str) {
    const parts = str.split('.');
    return new window.libomemo.OMEMOAddress(parts[0], parseInt(parts[1], 10));
};
window.libomemo.OMEMOAddress.prototype.getName = function () {
    return this.name;
};
window.libomemo.OMEMOAddress.prototype.getDeviceId = function () {
    return this.deviceId;
};
window.libomemo.OMEMOAddress.prototype.toString = function () {
    return this.name + '.' + this.deviceId;
};
// The ratchet metadata that the mocked decrypt methods report alongside the
// plaintext. Tests can override `counter`/`key` to drive the XEP-0384 heartbeat
// logic; the default counter is below the heartbeat threshold so ordinary
// decryption tests never trigger a heartbeat.
window.libomemo.mock_ratchet = { counter: 0, key: new Uint8Array([5, 1, 2, 3]).buffer };

Object.assign(window.libomemo, {
    // Mock Ed25519 key conversion: just return the input as-is (real impl converts Curve25519 → Ed25519)
    'curvePubKeyToEd25519PubKey': async (curve_key) => new Uint8Array(curve_key).slice(0, 32).buffer,
    'SessionCipher': function (storage, remote_address) {
        this.remoteAddress = remote_address;
        this.storage = storage;
        this.encrypt = () =>
            Promise.resolve({
                'type': 1,
                'body': 'c1ph3R73X7',
                'registrationId': '1337',
            });

        // The real libomemo SessionCipher/SessionBuilder reach into the store
        // (loadSignedPreKey, loadPreKey, getIdentityKeyPair, ...) and rely on a
        // specific return shape. We deliberately exercise those store methods
        // here, the same way libomemo does, so that store-interface regressions
        // are caught by tests.
        this.decryptPreKeyWhisperMessage = async (key_and_tag) => {
            // Mirror libomemo's SessionBuilder.processV3 + initSession.
            const signed_prekey = await storage.loadSignedPreKey(0);
            if (signed_prekey === undefined) {
                throw new Error('Missing Signed PreKey for PreKeyWhisperMessage');
            }
            // libomemo passes `signedPreKeyPair.keyPair` to initSession, which
            // then reads `ourSignedKey.privKey`. Dereferencing it here throws the
            // same TypeError at runtime if the store returns the wrong shape.
            if (!signed_prekey.keyPair.privKey) {
                throw new Error('Signed PreKey is missing a private key');
            }

            const prekey_ids = Object.keys(storage.getPreKeys());
            if (prekey_ids.length) {
                const prekey = await storage.loadPreKey(prekey_ids[0]);
                // libomemo passes `preKeyPair.keyPair` to initSession, which
                // then reads `ourEphemeralKey.privKey`.
                if (!prekey.keyPair.privKey) {
                    throw new Error('PreKey is missing a private key');
                }
            }

            const identity_keypair = await storage.getIdentityKeyPair();
            if (!identity_keypair.privKey) {
                throw new Error('Identity keypair is missing a private key');
            }

            return { plaintext: key_and_tag, ratchet: { ...window.libomemo.mock_ratchet } };
        };
        this.decryptWhisperMessage = async (key_and_tag) => {
            // Mirror libomemo's SessionCipher.doDecryptWhisperMessage, which
            // reads the identity keypair from the store.
            const identity_keypair = await storage.getIdentityKeyPair();
            if (!identity_keypair.privKey) {
                throw new Error('Identity keypair is missing a private key');
            }
            return { plaintext: key_and_tag, ratchet: { ...window.libomemo.mock_ratchet } };
        };
    },
    'SessionBuilder': function (_storage, _remote_address) {
        this.processPreKey = function () {
            return Promise.resolve();
        };
    },
    'KeyHelper': {
        'generateIdentityKeyPair': function () {
            return Promise.resolve({
                'pubKey': new TextEncoder('utf-8').encode('1234'),
                'privKey': new TextEncoder('utf-8').encode('4321'),
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
                    'privKey': new TextEncoder('utf-8').encode('4321'),
                },
            });
        },
        'generateSignedPreKey': function (_identity_keypair, keyid) {
            return Promise.resolve({
                'signature': new TextEncoder('utf-8').encode('11112222333344445555'),
                'keyId': keyid,
                'keyPair': {
                    'pubKey': new TextEncoder('utf-8').encode('1234'),
                    'privKey': new TextEncoder('utf-8').encode('4321'),
                },
            });
        },
    },
});

const map = current_contacts_map;
const groups_map = {};
Object.keys(map).forEach((k) => {
    const groups = map[k].length ? map[k] : ['Ungrouped'];
    Object.values(groups).forEach((g) => {
        groups_map[g] = groups_map[g] ? [...groups_map[g], k] : [k];
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
    'Ungrouped': 2,
};

// TODO: need to also test other roles and affiliations
const chatroom_roles = {
    'Anne Ebersbacher': { affiliation: 'owner', role: 'moderator' },
    'Dirk Theissen': { affiliation: 'admin', role: 'moderator' },
    'Dyon van de Wege': { affiliation: 'member', role: 'occupant' },
    'Felix Hofmann': { affiliation: 'member', role: 'occupant' },
    'Ka Lek': { affiliation: 'member', role: 'occupant' },
    'Thomas Kalb': { affiliation: 'member', role: 'occupant' },
};

const event = {
    'preventDefault': function () {},
};

async function deviceListFetched(_converse, jid, device_ids) {
    const { stx, u } = _converse.env;

    const selector = `iq[to="${jid}"] items[node="eu.siacs.conversations.axolotl.devicelist"]`;
    const iq_stanza = await u.waitUntil(() =>
        Array.from(_converse.api.connection.get().IQ_stanzas)
            .filter((iq) => iq.querySelector(selector))
            .pop(),
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
        _converse.api.connection.get()._dataRecv(createRequest(_converse, stanza));
    }
    return iq_stanza;
}

function ownDeviceHasBeenPublished(_converse) {
    return Array.from(_converse.api.connection.get().IQ_stanzas)
        .filter((iq) =>
            iq.querySelector(
                'iq[from="' + _converse.bare_jid + '"] publish[node="eu.siacs.conversations.axolotl.devicelist"]',
            ),
        )
        .pop();
}

function bundleHasBeenPublished(_converse) {
    const selector = 'publish[node="eu.siacs.conversations.axolotl.bundles:123456789"]';
    return Array.from(_converse.api.connection.get().IQ_stanzas)
        .filter((iq) => iq.querySelector(selector))
        .pop();
}

function v2BundleHasBeenPublished(_converse) {
    const { Strophe } = _converse.env;
    const selector = `publish[node="${Strophe.NS.OMEMO2_BUNDLES}"]`;
    return Array.from(_converse.api.connection.get().IQ_stanzas)
        .filter((iq) => iq.querySelector(selector))
        .pop();
}

function ownV2DeviceHasBeenPublished(_converse) {
    const { Strophe } = _converse.env;
    return Array.from(_converse.api.connection.get().IQ_stanzas)
        .filter((iq) =>
            iq.querySelector(`iq[from="${_converse.bare_jid}"] publish[node="${Strophe.NS.OMEMO2_DEVICELIST}"]`),
        )
        .pop();
}

function bundleIQRequestSent(_converse, jid, device_id) {
    return Array.from(_converse.api.connection.get().IQ_stanzas)
        .filter((iq) =>
            iq.querySelector(`iq[to="${jid}"] items[node="eu.siacs.conversations.axolotl.bundles:${device_id}"]`),
        )
        .pop();
}

async function bundleFetched(
    _converse,
    { jid, device_id, identity_key, signed_prekey_id, signed_prekey_public, signed_prekey_sig, prekeys },
) {
    const { stx, u } = _converse.env;
    const iq_stanza = await u.waitUntil(() => bundleIQRequestSent(_converse, jid, device_id));
    const stanza = stx`<iq from="${jid}"
            id="${iq_stanza.getAttribute('id')}"
            to="${_converse.bare_jid}"
            xmlns="jabber:server"
            type="result">
        <pubsub xmlns="http://jabber.org/protocol/pubsub">
            <items node="eu.siacs.conversations.axolotl.bundles:${device_id}">
                <item>
                    <bundle xmlns="eu.siacs.conversations.axolotl">
                        <signedPreKeyPublic signedPreKeyId="${signed_prekey_id}">
                            ${btoa(signed_prekey_public)}
                        </signedPreKeyPublic>
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
    _converse.api.connection.get()._dataRecv(createRequest(_converse, stanza));
}

/**
 * Sends an empty IQ result for the given request stanza.
 */
function sendIQResult(_converse, iq_stanza) {
    const { stx } = _converse.env;
    const stanza = stx`<iq from="${_converse.bare_jid}"
                            id="${iq_stanza.getAttribute('id')}"
                            to="${_converse.bare_jid}"
                            type="result"
                            xmlns="jabber:client"/>`;
    _converse.api.connection.get()._dataRecv(createRequest(_converse, stanza));
}

// Responds to the v2 (urn:xmpp:omemo:2) IQs which are published in the
// background during OMEMO initialization.
const deferred_v2_jids = new Set();

// The currently-running background v2 responder's stop function. Persisted at
// module scope so each `initializedOMEMO` can stop the previous one and start a
// fresh one bound to the current connection (the responder must outlive
// `initializedOMEMO` itself, since sends happen afterwards).
let stop_v2_responder = null;

/**
 * Mark a contact's omemo:2 device list as test-managed: the background
 * responder will not auto-answer its fetch, leaving the test to provide it.
 * @param {string} jid
 */
function deferV2DeviceList(jid) {
    deferred_v2_jids.add(jid);
}

function startV2Responder(_converse) {
    const { stx, Strophe } = _converse.env;
    const handled = new WeakSet();
    let active = true;

    const respond = () => {
        if (!active) return;
        const conn = _converse.api.connection.get();
        if (!conn) return;
        const iqs = Array.from(conn.IQ_stanzas);

        // Own v2 device list fetch
        const v2_fetch_selector = `iq[to="${_converse.bare_jid}"] items[node="${Strophe.NS.OMEMO2_DEVICELIST}"]`;
        iqs.filter((iq) => !handled.has(iq) && iq.querySelector(v2_fetch_selector)).forEach((iq) => {
            handled.add(iq);
            const result = stx`<iq from="${_converse.bare_jid}"
                                   id="${iq.getAttribute('id')}"
                                   to="${conn.jid}"
                                   xmlns="jabber:server"
                                   type="result">
                <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${Strophe.NS.OMEMO2_DEVICELIST}">
                        <item><devices xmlns="${Strophe.NS.OMEMO2}"/></item>
                    </items>
                </pubsub>
            </iq>`;
            conn._dataRecv(createRequest(_converse, result));
        });

        // Contact v2 device list fetch — answer with an empty list (no omemo:2
        // entry) unless the test opted to manage this jid itself. This keeps the
        // many legacy send tests working now that the send path fetches each
        // contact's v2 device list.
        iqs.filter(
            (iq) =>
                !handled.has(iq) &&
                iq.getAttribute('to') &&
                iq.getAttribute('to') !== _converse.bare_jid &&
                iq.querySelector(`items[node="${Strophe.NS.OMEMO2_DEVICELIST}"]`),
        ).forEach((iq) => {
            const to = iq.getAttribute('to');
            if (deferred_v2_jids.has(to)) return;
            handled.add(iq);
            const result = stx`<iq from="${to}"
                                   id="${iq.getAttribute('id')}"
                                   to="${conn.jid}"
                                   xmlns="jabber:server"
                                   type="result">
                <pubsub xmlns="${Strophe.NS.PUBSUB}">
                    <items node="${Strophe.NS.OMEMO2_DEVICELIST}">
                        <item><devices xmlns="${Strophe.NS.OMEMO2}"/></item>
                    </items>
                </pubsub>
            </iq>`;
            conn._dataRecv(createRequest(_converse, result));
        });

        // v2 device list publish + v2 bundle publish (both answered with empty result)
        const publish_v2 = (iq) =>
            iq.querySelector(`iq[from="${_converse.bare_jid}"] publish[node="${Strophe.NS.OMEMO2_DEVICELIST}"]`) ||
            iq.querySelector(`publish[node="${Strophe.NS.OMEMO2_BUNDLES}"]`);
        iqs.filter((iq) => !handled.has(iq) && publish_v2(iq)).forEach((iq) => {
            handled.add(iq);
            sendIQResult(_converse, iq);
        });
    };

    const interval = setInterval(respond, 50);
    return () => {
        active = false;
        clearInterval(interval);
    };
}

async function initializedOMEMO(
    _converse,
    identities = [{ 'category': 'pubsub', 'type': 'pep' }],
    features = ['http://jabber.org/protocol/pubsub#publish-options'],
) {
    const { u } = _converse.env;
    await waitUntilDiscoConfirmed(_converse, _converse.bare_jid, identities, features);

    // Respond to the background v2 IQs throughout initialization *and* for the
    // rest of the test — the send path fetches each contact's v2 device list,
    // which happens after this helper returns. Stop any responder left over from
    // a previous test and reset the test-managed jids, then start a fresh one
    // bound to the current connection. The responder only ever answers omemo:2
    // IQs, so if it outlives the test it's a no-op for non-OMEMO tests and is
    // replaced by the next `initializedOMEMO`.
    stop_v2_responder?.();
    deferred_v2_jids.clear();
    stop_v2_responder = startV2Responder(_converse);

    // Respond to legacy device list fetch
    await deviceListFetched(_converse, _converse.bare_jid, ['482886413b977930064a5888b92134fe']);

    // Respond to legacy device list publish
    let iq_stanza = await u.waitUntil(() => ownDeviceHasBeenPublished(_converse));
    sendIQResult(_converse, iq_stanza);

    // Respond to legacy bundle publish
    iq_stanza = await u.waitUntil(() => bundleHasBeenPublished(_converse));
    sendIQResult(_converse, iq_stanza);

    await _converse.api.waitUntil('OMEMOInitialized');

    // Drain any trailing background v2 IQs — the v2 device-list and bundle
    // publishes can land just after OMEMOInitialized.
    for (let i = 0; i < 4; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}

export default {
    bundleFetched,
    bundleHasBeenPublished,
    bundleIQRequestSent,
    v2BundleHasBeenPublished,
    ownV2DeviceHasBeenPublished,
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
    deferV2DeviceList,
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
    waitUntilDiscoConfirmed,
};
