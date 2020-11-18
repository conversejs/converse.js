/**
 * @module converse-omemo
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
/* global libsignal */

import "converse-profile";
import log from "@converse/headless/log";
import { Collection } from "@converse/skeletor/src/collection";
import { Model } from '@converse/skeletor/src/model.js';
import { __ } from './i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";
import { concat, debounce, difference, invokeMap, range, omit } from "lodash-es";
import { html } from 'lit-html';

const { Strophe, sizzle, $build, $iq, $msg } = converse.env;
const u = converse.env.utils;

Strophe.addNamespace('OMEMO_DEVICELIST', Strophe.NS.OMEMO+".devicelist");
Strophe.addNamespace('OMEMO_VERIFICATION', Strophe.NS.OMEMO+".verification");
Strophe.addNamespace('OMEMO_WHITELISTED', Strophe.NS.OMEMO+".whitelisted");
Strophe.addNamespace('OMEMO_BUNDLES', Strophe.NS.OMEMO+".bundles");

const UNDECIDED = 0;
const TRUSTED = 1; // eslint-disable-line no-unused-vars
const UNTRUSTED = -1;
const TAG_LENGTH = 128;
const KEY_ALGO = {
    'name': "AES-GCM",
    'length': 128
};


class IQError extends Error {
    constructor (message, iq) {
        super(message, iq);
        this.name = 'IQError';
        this.iq = iq;
    }
}


function parseEncryptedMessage (stanza, attrs) {
    if (attrs.is_encrypted && attrs.encrypted.key) {
        // https://xmpp.org/extensions/xep-0384.html#usecases-receiving
        if (attrs.encrypted.prekey === true) {
            return decryptPrekeyWhisperMessage(attrs);
        } else {
            return decryptWhisperMessage(attrs);
        }
    } else {
        return attrs;
    }
}


function onChatBoxesInitialized () {
    _converse.chatboxes.on('add', chatbox => {
        checkOMEMOSupported(chatbox);
        if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
            chatbox.occupants.on('add', o => onOccupantAdded(chatbox, o));
            chatbox.features.on('change', () => checkOMEMOSupported(chatbox));
        }
    });
}


function onChatInitialized (view) {
    view.listenTo(view.model.messages, 'add', (message) => {
        if (message.get('is_encrypted') && !message.get('is_error')) {
            view.model.save('omemo_supported', true);
        }
    });
    view.listenTo(view.model, 'change:omemo_supported', () => {
        if (!view.model.get('omemo_supported') && view.model.get('omemo_active')) {
            view.model.set('omemo_active', false);
        } else {
            // Manually trigger an update, setting omemo_active to
            // false above will automatically trigger one.
            view.el.querySelector('converse-chat-toolbar')?.requestUpdate();
        }
    });
    view.listenTo(view.model, 'change:omemo_active', () => {
        view.el.querySelector('converse-chat-toolbar').requestUpdate();
    });
}


const omemo = converse.env.omemo = {

    async encryptMessage (plaintext) {
        // The client MUST use fresh, randomly generated key/IV pairs
        // with AES-128 in Galois/Counter Mode (GCM).

        // For GCM a 12 byte IV is strongly suggested as other IV lengths
        // will require additional calculations. In principle any IV size
        // can be used as long as the IV doesn't ever repeat. NIST however
        // suggests that only an IV size of 12 bytes needs to be supported
        // by implementations.
        //
        // https://crypto.stackexchange.com/questions/26783/ciphertext-and-tag-size-and-iv-transmission-with-aes-in-gcm-mode
        const iv = crypto.getRandomValues(new window.Uint8Array(12)),
                key = await crypto.subtle.generateKey(KEY_ALGO, true, ["encrypt", "decrypt"]),
                algo = {
                    'name': 'AES-GCM',
                    'iv': iv,
                    'tagLength': TAG_LENGTH
                },
                encrypted = await crypto.subtle.encrypt(algo, key, u.stringToArrayBuffer(plaintext)),
                length = encrypted.byteLength - ((128 + 7) >> 3),
                ciphertext = encrypted.slice(0, length),
                tag = encrypted.slice(length),
                exported_key = await crypto.subtle.exportKey("raw", key);

        return {
            'key': exported_key,
            'tag': tag,
            'key_and_tag': u.appendArrayBuffer(exported_key, tag),
            'payload': u.arrayBufferToBase64(ciphertext),
            'iv': u.arrayBufferToBase64(iv)
        };
    },

    async decryptMessage (obj) {
        const key_obj = await crypto.subtle.importKey('raw', obj.key, KEY_ALGO, true, ['encrypt','decrypt']);
        const cipher = u.appendArrayBuffer(u.base64ToArrayBuffer(obj.payload), obj.tag);
        const algo = {
            'name': "AES-GCM",
            'iv': u.base64ToArrayBuffer(obj.iv),
            'tagLength': TAG_LENGTH
        };
        return u.arrayBufferToString(await crypto.subtle.decrypt(algo, key_obj, cipher));
    }
};

function getSessionCipher (jid, id) {
    const address = new libsignal.SignalProtocolAddress(jid, id);
    return new window.libsignal.SessionCipher(_converse.omemo_store, address);
}

async function handleDecryptedWhisperMessage (attrs, key_and_tag) {
    const encrypted = attrs.encrypted;
    const devicelist = _converse.devicelists.getDeviceList(attrs.from);
    await devicelist._devices_promise;

    let device = devicelist.get(encrypted.device_id);
    if (!device) {
        device = await devicelist.devices.create({'id': encrypted.device_id, 'jid': attrs.from}, {'promise': true});
    }
    if (encrypted.payload) {
        const key = key_and_tag.slice(0, 16);
        const tag = key_and_tag.slice(16);
        const result = await omemo.decryptMessage(Object.assign(encrypted, {'key': key, 'tag': tag}));
        device.save('active', true);
        return result;
    }
}

function getDecryptionErrorAttributes (e) {
    if (api.settings.get("loglevel") === 'debug') {
        return {
            'error_text': __("Sorry, could not decrypt a received OMEMO message due to an error.") + ` ${e.name} ${e.message}`,
            'error_type': 'Decryption',
            'is_ephemeral': true,
            'is_error': true,
            'type': 'error',
        }
    } else {
        return {};
    }
}

async function decryptPrekeyWhisperMessage (attrs) {
    const session_cipher = getSessionCipher(attrs.from, parseInt(attrs.encrypted.device_id, 10));
    const key = u.base64ToArrayBuffer(attrs.encrypted.key);
    let key_and_tag;
    try {
        key_and_tag = await session_cipher.decryptPreKeyWhisperMessage(key, 'binary');
    } catch (e) {
        // TODO from the XEP:
        // There are various reasons why decryption of an
        // OMEMOKeyExchange or an OMEMOAuthenticatedMessage
        // could fail. One reason is if the message was
        // received twice and already decrypted once, in this
        // case the client MUST ignore the decryption failure
        // and not show any warnings/errors. In all other cases
        // of decryption failure, clients SHOULD respond by
        // forcibly doing a new key exchange and sending a new
        // OMEMOKeyExchange with a potentially empty SCE
        // payload. By building a new session with the original
        // sender this way, the invalid session of the original
        // sender will get overwritten with this newly created,
        // valid session.
        log.error(`${e.name} ${e.message}`);
        return Object.assign(attrs, getDecryptionErrorAttributes(e));
    }
    // TODO from the XEP:
    // When a client receives the first message for a given
    // ratchet key with a counter of 53 or higher, it MUST send
    // a heartbeat message. Heartbeat messages are normal OMEMO
    // encrypted messages where the SCE payload does not include
    // any elements. These heartbeat messages cause the ratchet
    // to forward, thus consequent messages will have the
    // counter restarted from 0.
    try {
        const plaintext = await handleDecryptedWhisperMessage(attrs, key_and_tag);
        await _converse.omemo_store.generateMissingPreKeys();
        await _converse.omemo_store.publishBundle();
        if (plaintext) {
            return Object.assign(attrs, {'plaintext': plaintext});
        } else {
            return Object.assign(attrs, {'is_only_key': true});
        }
    } catch (e) {
        log.error(`${e.name} ${e.message}`);
        return Object.assign(attrs, getDecryptionErrorAttributes(e));
    }
}

async function decryptWhisperMessage (attrs) {
    const from_jid = attrs.from_muc ? attrs.from_real_jid : attrs.from;
    if (!from_jid) {
        Object.assign(attrs, {
            'error_text': __("Sorry, could not decrypt a received OMEMO because we don't have the JID for that user."),
            'error_type': 'Decryption',
            'is_ephemeral': false,
            'is_error': true,
            'type': 'error',
        });
    }
    const session_cipher = getSessionCipher(from_jid, parseInt(attrs.encrypted.device_id, 10));
    const key = u.base64ToArrayBuffer(attrs.encrypted.key);
    try {
        const key_and_tag = await session_cipher.decryptWhisperMessage(key, 'binary')
        const plaintext = await handleDecryptedWhisperMessage(attrs, key_and_tag);
        return Object.assign(attrs, {'plaintext': plaintext});
    } catch (e) {
        log.error(`${e.name} ${e.message}`);
        return Object.assign(attrs, getDecryptionErrorAttributes(e));
    }
}

function addKeysToMessageStanza (stanza, dicts, iv) {
    for (const i in dicts) {
        if (Object.prototype.hasOwnProperty.call(dicts, i)) {
            const payload = dicts[i].payload;
            const device = dicts[i].device;
            const prekey = 3 == parseInt(payload.type, 10);

            stanza.c('key', {'rid': device.get('id') }).t(btoa(payload.body));
            if (prekey) {
                stanza.attrs({'prekey': prekey});
            }
            stanza.up();
            if (i == dicts.length-1) {
                stanza.c('iv').t(iv).up().up()
            }
        }
    }
    return Promise.resolve(stanza);
}


function parseBundle (bundle_el) {
    /* Given an XML element representing a user's OMEMO bundle, parse it
     * and return a map.
     */
    const signed_prekey_public_el = bundle_el.querySelector('signedPreKeyPublic');
    const signed_prekey_signature_el = bundle_el.querySelector('signedPreKeySignature');
    const prekeys = sizzle(`prekeys > preKeyPublic`, bundle_el)
        .map(el => ({
            'id': parseInt(el.getAttribute('preKeyId'), 10),
            'key': el.textContent
        }));
    return {
        'identity_key': bundle_el.querySelector('identityKey').textContent.trim(),
        'signed_prekey': {
            'id': parseInt(signed_prekey_public_el.getAttribute('signedPreKeyId'), 10),
            'public_key': signed_prekey_public_el.textContent,
            'signature': signed_prekey_signature_el.textContent
        },
        'prekeys': prekeys
    }
}

async function generateFingerprint (device) {
    if (device.get('bundle')?.fingerprint) {
        return;
    }
    const bundle = await device.getBundle();
    bundle['fingerprint'] = u.arrayBufferToHex(u.base64ToArrayBuffer(bundle['identity_key']));
    device.save('bundle', bundle);
    device.trigger('change:bundle'); // Doesn't get triggered automatically due to pass-by-reference
}


async function getDevicesForContact (jid) {
    await api.waitUntil('OMEMOInitialized');
    const devicelist = _converse.devicelists.get(jid) || _converse.devicelists.create({'jid': jid});
    await devicelist.fetchDevices();
    return devicelist.devices;
}

function generateDeviceID () {
    /* Generates a device ID, making sure that it's unique */
    const existing_ids = _converse.devicelists.get(_converse.bare_jid).devices.pluck('id');
    let device_id = libsignal.KeyHelper.generateRegistrationId();

    // Before publishing a freshly generated device id for the first time,
    // a device MUST check whether that device id already exists, and if so, generate a new one.
    let i = 0;
    while (existing_ids.includes(device_id)) {
        device_id = libsignal.KeyHelper.generateRegistrationId();
        i++;
        if (i === 10) {
            throw new Error("Unable to generate a unique device ID");
        }
    }
    return device_id.toString();
}

async function buildSession (device) {
    // TODO: check device-get('jid') versus the 'from' attribute which is used
    // to build a session when receiving an encrypted message in a MUC.
    // https://github.com/conversejs/converse.js/issues/1481#issuecomment-509183431
    const address = new libsignal.SignalProtocolAddress(device.get('jid'), device.get('id'));
    const sessionBuilder = new libsignal.SessionBuilder(_converse.omemo_store, address);
    const prekey = device.getRandomPreKey();
    const bundle = await device.getBundle();

    return sessionBuilder.processPreKey({
        'registrationId': parseInt(device.get('id'), 10),
        'identityKey': u.base64ToArrayBuffer(bundle.identity_key),
        'signedPreKey': {
            'keyId': bundle.signed_prekey.id, // <Number>
            'publicKey': u.base64ToArrayBuffer(bundle.signed_prekey.public_key),
            'signature': u.base64ToArrayBuffer(bundle.signed_prekey.signature)
        },
        'preKey': {
            'keyId': prekey.id, // <Number>
            'publicKey': u.base64ToArrayBuffer(prekey.key),
        }
    });
}

async function getSession (device) {
    if (!device.get('bundle')) {
        log.error(`Could not build an OMEMO session for device ${device.get('id')} because we don't have its bundle`);
        return null;
    }
    const address = new libsignal.SignalProtocolAddress(device.get('jid'), device.get('id'));
    const session = await _converse.omemo_store.loadSession(address.toString());
    if (session) {
        return session;
    } else {
        try {
            const session = await buildSession(device);
            return session;
        } catch (e) {
            log.error(`Could not build an OMEMO session for device ${device.get('id')}`);
            log.error(e);
            return null;
        }
    }
}

function updateBundleFromStanza (stanza) {
    const items_el = sizzle(`items`, stanza).pop();
    if (!items_el || !items_el.getAttribute('node').startsWith(Strophe.NS.OMEMO_BUNDLES)) {
        return;
    }
    const device_id = items_el.getAttribute('node').split(':')[1];
    const jid = stanza.getAttribute('from');
    const bundle_el = sizzle(`item > bundle`, items_el).pop();
    const devicelist = _converse.devicelists.getDeviceList(jid);
    const device = devicelist.devices.get(device_id) || devicelist.devices.create({'id': device_id, 'jid': jid});
    device.save({'bundle': parseBundle(bundle_el)});
}

function updateDevicesFromStanza (stanza) {
    const items_el = sizzle(`items[node="${Strophe.NS.OMEMO_DEVICELIST}"]`, stanza).pop();
    if (!items_el) {
        return;
    }
    const device_selector = `item list[xmlns="${Strophe.NS.OMEMO}"] device`;
    const device_ids = sizzle(device_selector, items_el).map(d => d.getAttribute('id'));
    const jid = stanza.getAttribute('from');
    const devicelist = _converse.devicelists.getDeviceList(jid);
    const devices = devicelist.devices;
    const removed_ids = difference(devices.pluck('id'), device_ids);

    removed_ids.forEach(id => {
        if (jid === _converse.bare_jid && id === _converse.omemo_store.get('device_id')) {
            return // We don't set the current device as inactive
        }
        devices.get(id).save('active', false);
    });
    device_ids.forEach(device_id => {
        const device = devices.get(device_id);
        if (device) {
            device.save('active', true);
        } else {
            devices.create({'id': device_id, 'jid': jid})
        }
    });
    if (u.isSameBareJID(jid, _converse.bare_jid)) {
        // Make sure our own device is on the list
        // (i.e. if it was removed, add it again).
        devicelist.publishCurrentDevice(device_ids);
    }
}

function registerPEPPushHandler () {
    // Add a handler for devices pushed from other connected clients
    _converse.connection.addHandler((message) => {
        try {
            if (sizzle(`event[xmlns="${Strophe.NS.PUBSUB}#event"]`, message).length) {
                updateDevicesFromStanza(message);
                updateBundleFromStanza(message);
            }
        } catch (e) {
            log.error(e.message);
        }
        return true;
    }, null, 'message', 'headline');
}

function restoreOMEMOSession () {
    if (_converse.omemo_store === undefined)  {
        const id = `converse.omemosession-${_converse.bare_jid}`;
        _converse.omemo_store = new _converse.OMEMOStore({'id': id});
        _converse.omemo_store.browserStorage = _converse.createStore(id);
    }
    return _converse.omemo_store.fetchSession();
}


function fetchDeviceLists () {
    return new Promise((success, error) => _converse.devicelists.fetch({success, 'error': (m, e) => error(e)}));
}

async function fetchOwnDevices () {
    await fetchDeviceLists();
    let own_devicelist = _converse.devicelists.get(_converse.bare_jid);
    if (own_devicelist) {
        own_devicelist.fetchDevices();
    } else {
        own_devicelist = await _converse.devicelists.create({'jid': _converse.bare_jid}, {'promise': true});
    }
    return own_devicelist._devices_promise;
}

async function initOMEMO () {
    if (!_converse.config.get('trusted') || api.settings.get('clear_cache_on_logout')) {
        log.warn("Not initializing OMEMO, since this browser is not trusted or clear_cache_on_logout is set to true");
        return;
    }
    _converse.devicelists = new _converse.DeviceLists();
    const id = `converse.devicelists-${_converse.bare_jid}`;
    _converse.devicelists.browserStorage = _converse.createStore(id);

    try {
        await fetchOwnDevices();
        await restoreOMEMOSession();
        await _converse.omemo_store.publishBundle();
    } catch (e) {
        log.error("Could not initialize OMEMO support");
        log.error(e);
        return;
    }
    /**
     * Triggered once OMEMO support has been initialized
     * @event _converse#OMEMOInitialized
     * @example _converse.api.listen.on('OMEMOInitialized', () => { ... }); */
    api.trigger('OMEMOInitialized');
}

async function onOccupantAdded (chatroom, occupant) {
    if (occupant.isSelf() || !chatroom.features.get('nonanonymous') || !chatroom.features.get('membersonly')) {
        return;
    }
    if (chatroom.get('omemo_active')) {
        const supported = await _converse.contactHasOMEMOSupport(occupant.get('jid'));
        if (!supported) {
            chatroom.createMessage({
                'message': __("%1$s doesn't appear to have a client that supports OMEMO. " +
                                "Encrypted chat will no longer be possible in this grouchat.", occupant.get('nick')),
                'type': 'error'
            });
            chatroom.save({'omemo_active': false, 'omemo_supported': false});
        }
    }
}

async function checkOMEMOSupported (chatbox) {
    let supported;
    if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
        await api.waitUntil('OMEMOInitialized');
        supported = chatbox.features.get('nonanonymous') && chatbox.features.get('membersonly');
    } else if (chatbox.get('type') === _converse.PRIVATE_CHAT_TYPE) {
        supported = await _converse.contactHasOMEMOSupport(chatbox.get('jid'));
    }
    chatbox.set('omemo_supported', supported);
    if (supported && api.settings.get('omemo_default')) {
        chatbox.set('omemo_active', true);
    }
}

function toggleOMEMO (ev) {
    ev.stopPropagation();
    ev.preventDefault();
    const toolbar_el = u.ancestor(ev.target, 'converse-chat-toolbar');
    if (!toolbar_el.model.get('omemo_supported')) {
        let messages;
        if (toolbar_el.model.get('type') === _converse.CHATROOMS_TYPE) {
            messages = [__(
                'Cannot use end-to-end encryption in this groupchat, '+
                'either the groupchat has some anonymity or not all participants support OMEMO.'
            )];
        } else {
            messages = [__(
                "Cannot use end-to-end encryption because %1$s uses a client that doesn't support OMEMO.",
                toolbar_el.model.contact.getDisplayName()
            )];
        }
        return api.alert('error', __('Error'), messages);
    }
    toolbar_el.model.save({'omemo_active': !toolbar_el.model.get('omemo_active')});
}


function getOMEMOToolbarButton (toolbar_el, buttons) {
    const model = toolbar_el.model;
    const is_muc = model.get('type') === _converse.CHATROOMS_TYPE;
    let title;
    if (is_muc && model.get('omemo_supported')) {
        const i18n_plaintext = __('Messages are being sent in plaintext');
        const i18n_encrypted = __('Messages are sent encrypted');
        title = model.get('omemo_active') ? i18n_encrypted : i18n_plaintext;
    } else {
        title = __('This groupchat needs to be members-only and non-anonymous in '+
                    'order to support OMEMO encrypted messages');
    }

    buttons.push(html`
        <button class="toggle-omemo"
                title="${title}"
                ?disabled=${!model.get('omemo_supported')}
                @click=${toggleOMEMO}>
        <converse-icon class="fa ${model.get('omemo_active') ? `fa-lock` : `fa-unlock`}"
                    path-prefix="${api.settings.get('assets_path')}" size="1em"
                    color="${model.get('omemo_active') ? `var(--info-color)` : `var(--error-color)`}"
        ></converse-icon>
        </button>`
    );
    return buttons;
}


/**
 * Mixin object that contains OMEMO-related methods for
 * {@link _converse.ChatBox} or {@link _converse.ChatRoom} objects.
 *
 * @typedef {Object} OMEMOEnabledChatBox
 */
const OMEMOEnabledChatBox = {

    encryptKey (plaintext, device) {
        return getSessionCipher(device.get('jid'), device.get('id'))
            .encrypt(plaintext)
            .then(payload => ({'payload': payload, 'device': device}));
    },

    handleMessageSendError (e) {
        if (e.name === 'IQError') {
            this.save('omemo_supported', false);

            const err_msgs = [];
            if (sizzle(`presence-subscription-required[xmlns="${Strophe.NS.PUBSUB_ERROR}"]`, e.iq).length) {
                err_msgs.push(
                    __("Sorry, we're unable to send an encrypted message because %1$s "+
                       "requires you to be subscribed to their presence in order to see their OMEMO information",
                        e.iq.getAttribute('from'))
                );
            } else if (sizzle(`remote-server-not-found[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]`, e.iq).length) {
                err_msgs.push(
                    __("Sorry, we're unable to send an encrypted message because the remote server for %1$s could not be found",
                        e.iq.getAttribute('from'))
                );
            } else {
                err_msgs.push(__("Unable to send an encrypted message due to an unexpected error."));
                err_msgs.push(e.iq.outerHTML);
            }
            api.alert('error', __('Error'), err_msgs);
            log.error(e);
        } else if (e.user_facing) {
            api.alert('error', __('Error'), [e.message]);
            log.error(e);
        } else {
            throw e;
        }
    }
}


converse.plugins.add('converse-omemo', {

    enabled (_converse) {
        return window.libsignal &&
            _converse.config.get('trusted') &&
            !api.settings.get('clear_cache_on_logout') &&
            !_converse.api.settings.get("blacklisted_plugins").includes('converse-omemo');
    },

    dependencies: ["converse-chatview", "converse-pubsub", "converse-profile"],

    overrides: {

        ProfileModal: {
            events: {
                'change input.select-all': 'selectAll',
                'click .generate-bundle': 'generateOMEMODeviceBundle',
                'submit .fingerprint-removal': 'removeSelectedFingerprints'
            },

            initialize () {
                this.debouncedRender = debounce(this.render, 50);
                this.devicelist = _converse.devicelists.get(_converse.bare_jid);
                this.listenTo(this.devicelist.devices, 'change:bundle', this.debouncedRender);
                this.listenTo(this.devicelist.devices, 'reset', this.debouncedRender);
                this.listenTo(this.devicelist.devices, 'reset', this.debouncedRender);
                this.listenTo(this.devicelist.devices, 'remove', this.debouncedRender);
                this.listenTo(this.devicelist.devices, 'add', this.debouncedRender);
                return this.__super__.initialize.apply(this, arguments);
            },

            beforeRender () {
                const device_id = _converse.omemo_store.get('device_id');

                if (device_id) {
                    this.current_device = this.devicelist.devices.get(device_id);
                }
                this.other_devices = this.devicelist.devices.filter(d => (d.get('id') !== device_id));
                if (this.__super__.beforeRender) {
                    return this.__super__.beforeRender.apply(this, arguments);
                }
            },

            selectAll (ev) {
                let sibling = u.ancestor(ev.target, 'li');
                while (sibling) {
                    sibling.querySelector('input[type="checkbox"]').checked = ev.target.checked;
                    sibling = sibling.nextElementSibling;
                }
            },

            removeSelectedFingerprints (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                ev.target.querySelector('.select-all').checked = false
                const device_ids = sizzle('.fingerprint-removal-item input[type="checkbox"]:checked', ev.target).map(c => c.value);
                this.devicelist.removeOwnDevices(device_ids)
                    .then(this.modal.hide)
                    .catch(err => {
                        log.error(err);
                        _converse.api.alert(
                            Strophe.LogLevel.ERROR,
                            __('Error'), [__('Sorry, an error occurred while trying to remove the devices.')]
                        )
                    });
            },

            generateOMEMODeviceBundle (ev) {
                ev.preventDefault();
                if (confirm(__(
                    "Are you sure you want to generate new OMEMO keys? " +
                    "This will remove your old keys and all previously encrypted messages will no longer be decryptable on this device.")
                )) {
                    api.omemo.bundle.generate();
                }
            }
        },

        UserDetailsModal: {
            events: {
                'click .fingerprint-trust .btn input': 'toggleDeviceTrust'
            },

            initialize () {
                const jid = this.model.get('jid');
                this.devicelist = _converse.devicelists.getDeviceList(jid);
                this.listenTo(this.devicelist.devices, 'change:bundle', this.render);
                this.listenTo(this.devicelist.devices, 'change:trusted', this.render);
                this.listenTo(this.devicelist.devices, 'remove', this.render);
                this.listenTo(this.devicelist.devices, 'add', this.render);
                this.listenTo(this.devicelist.devices, 'reset', this.render);
                return this.__super__.initialize.apply(this, arguments);
            },

            toggleDeviceTrust (ev) {
                const radio = ev.target;
                const device = this.devicelist.devices.get(radio.getAttribute('name'));
                device.save('trusted', parseInt(radio.value, 10));
            }
        },

        ChatBox: {
            async sendMessage (text, spoiler_hint) {
                if (this.get('omemo_active') && text) {
                    const attrs = this.getOutgoingMessageAttributes(text, spoiler_hint);
                    attrs['is_encrypted'] = true;
                    attrs['plaintext'] = attrs.message;
                    let message, stanza;
                    try {
                        const devices = await _converse.getBundlesAndBuildSessions(this);
                        message = await this.createMessage(attrs);
                        stanza = await _converse.createOMEMOMessageStanza(this, message, devices);
                    } catch (e) {
                        this.handleMessageSendError(e);
                        return null;
                    }
                    _converse.api.send(stanza);
                    return message;
                } else {
                    return this.__super__.sendMessage.apply(this, arguments);
                }
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by Converse.js's plugin machinery.
         */

        api.settings.extend({'omemo_default': false});
        api.promises.add(['OMEMOInitialized']);

        _converse.NUM_PREKEYS = 100; // Set here so that tests can override

        Object.assign(_converse.ChatBox.prototype, OMEMOEnabledChatBox);


        _converse.generateFingerprints = async function (jid) {
            const devices = await getDevicesForContact(jid)
            return Promise.all(devices.map(d => generateFingerprint(d)));
        }

        _converse.getDeviceForContact = function (jid, device_id) {
            return getDevicesForContact(jid).then(devices => devices.get(device_id));
        }

        _converse.contactHasOMEMOSupport = async function (jid) {
            /* Checks whether the contact advertises any OMEMO-compatible devices. */
            const devices = await getDevicesForContact(jid);
            return devices.length > 0;
        }

        _converse.getBundlesAndBuildSessions = async function (chatbox) {
            const no_devices_err = __("Sorry, no devices found to which we can send an OMEMO encrypted message.");
            let devices;
            if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
                const collections = await Promise.all(chatbox.occupants.map(o => getDevicesForContact(o.get('jid'))));
                devices = collections.reduce((a, b) => concat(a, b.models), []);
            } else if (chatbox.get('type') === _converse.PRIVATE_CHAT_TYPE) {
                const their_devices = await getDevicesForContact(chatbox.get('jid'));
                if (their_devices.length === 0) {
                    const err = new Error(no_devices_err);
                    err.user_facing = true;
                    throw err;
                }
                const own_devices = _converse.devicelists.get(_converse.bare_jid).devices;
                devices = [...own_devices.models, ...their_devices.models];
            }
            // Filter out our own device
            const id = _converse.omemo_store.get('device_id');
            devices = devices.filter(d => d.get('id') !== id);
            // Fetch bundles if necessary
            await Promise.all(devices.map(d => d.getBundle()));

            const sessions = devices.filter(d => d).map(d => getSession(d));
            await Promise.all(sessions);
            if (sessions.includes(null)) {
                // We couldn't build a session for certain devices.
                devices = devices.filter(d => sessions[devices.indexOf(d)]);
                if (devices.length === 0) {
                    const err = new Error(no_devices_err);
                    err.user_facing = true;
                    throw err;
                }
            }
            return devices;
        }

        _converse.createOMEMOMessageStanza = function (chatbox, message, devices) {
            const body = __("This is an OMEMO encrypted message which your client doesn’t seem to support. "+
                            "Find more information on https://conversations.im/omemo");

            if (!message.get('message')) {
                throw new Error("No message body to encrypt!");
            }
            const stanza = $msg({
                    'from': _converse.connection.jid,
                    'to': chatbox.get('jid'),
                    'type': chatbox.get('message_type'),
                    'id': message.get('msgid')
                }).c('body').t(body).up()

            if (message.get('type') === 'chat') {
                stanza.c('request', {'xmlns': Strophe.NS.RECEIPTS}).up();
            }
            // An encrypted header is added to the message for
            // each device that is supposed to receive it.
            // These headers simply contain the key that the
            // payload message is encrypted with,
            // and they are separately encrypted using the
            // session corresponding to the counterpart device.
            stanza.c('encrypted', {'xmlns': Strophe.NS.OMEMO})
                  .c('header', {'sid':  _converse.omemo_store.get('device_id')});

            return omemo.encryptMessage(message.get('message')).then(obj => {
                // The 16 bytes key and the GCM authentication tag (The tag
                // SHOULD have at least 128 bit) are concatenated and for each
                // intended recipient device, i.e. both own devices as well as
                // devices associated with the contact, the result of this
                // concatenation is encrypted using the corresponding
                // long-standing SignalProtocol session.
                const promises = devices
                    .filter(device => (device.get('trusted') != UNTRUSTED && device.get('active')))
                    .map(device => chatbox.encryptKey(obj.key_and_tag, device));

                return Promise.all(promises)
                    .then(dicts => addKeysToMessageStanza(stanza, dicts, obj.iv))
                    .then(stanza => {
                        stanza.c('payload').t(obj.payload).up().up();
                        stanza.c('store', {'xmlns': Strophe.NS.HINTS});
                        return stanza;
                    });
            });
        }


        _converse.OMEMOStore = Model.extend({

            Direction: {
                SENDING: 1,
                RECEIVING: 2,
            },

            getIdentityKeyPair () {
                const keypair = this.get('identity_keypair');
                return Promise.resolve({
                    'privKey': u.base64ToArrayBuffer(keypair.privKey),
                    'pubKey': u.base64ToArrayBuffer(keypair.pubKey)
                });
            },

            getLocalRegistrationId () {
                return Promise.resolve(parseInt(this.get('device_id'), 10));
            },

            isTrustedIdentity (identifier, identity_key, direction) {  // eslint-disable-line no-unused-vars
                if (identifier === null || identifier === undefined) {
                    throw new Error("Can't check identity key for invalid key");
                }
                if (!(identity_key instanceof ArrayBuffer)) {
                    throw new Error("Expected identity_key to be an ArrayBuffer");
                }
                const trusted = this.get('identity_key'+identifier);
                if (trusted === undefined) {
                    return Promise.resolve(true);
                }
                return Promise.resolve(u.arrayBufferToBase64(identity_key) === trusted);
            },

            loadIdentityKey (identifier) {
                if (identifier === null || identifier === undefined) {
                    throw new Error("Can't load identity_key for invalid identifier");
                }
                return Promise.resolve(u.base64ToArrayBuffer(this.get('identity_key'+identifier)));
            },

            saveIdentity (identifier, identity_key) {
                if (identifier === null || identifier === undefined) {
                    throw new Error("Can't save identity_key for invalid identifier");
                }
                const address = new libsignal.SignalProtocolAddress.fromString(identifier);
                const existing = this.get('identity_key'+address.getName());
                const b64_idkey = u.arrayBufferToBase64(identity_key);
                this.save('identity_key'+address.getName(), b64_idkey)

                if (existing && b64_idkey !== existing) {
                    return Promise.resolve(true);
                } else {
                    return Promise.resolve(false);
                }
            },

            getPreKeys () {
                return this.get('prekeys') || {};
            },

            loadPreKey (key_id) {
                const res = this.getPreKeys()[key_id];
                if (res) {
                    return Promise.resolve({
                        'privKey': u.base64ToArrayBuffer(res.privKey),
                        'pubKey': u.base64ToArrayBuffer(res.pubKey)
                    });
                }
                return Promise.resolve();
            },

            storePreKey (key_id, key_pair) {
                const prekey = {};
                prekey[key_id] = {
                    'pubKey': u.arrayBufferToBase64(key_pair.pubKey),
                    'privKey': u.arrayBufferToBase64(key_pair.privKey)
                }
                this.save('prekeys', Object.assign(this.getPreKeys(), prekey));
                return Promise.resolve();
            },

            removePreKey (key_id) {
                this.save('prekeys', omit(this.getPreKeys(), key_id));
                return Promise.resolve();
            },

            loadSignedPreKey (keyId) {  // eslint-disable-line no-unused-vars
                const res = this.get('signed_prekey');
                if (res) {
                    return Promise.resolve({
                        'privKey': u.base64ToArrayBuffer(res.privKey),
                        'pubKey': u.base64ToArrayBuffer(res.pubKey)
                    });
                }
                return Promise.resolve();
            },

            storeSignedPreKey (spk) {
                if (typeof spk !== "object") {
                    // XXX: We've changed the signature of this method from the
                    // example given in InMemorySignalProtocolStore.
                    // Should be fine because the libsignal code doesn't
                    // actually call this method.
                    throw new Error("storeSignedPreKey: expected an object");
                }
                this.save('signed_prekey', {
                    'id': spk.keyId,
                    'privKey': u.arrayBufferToBase64(spk.keyPair.privKey),
                    'pubKey': u.arrayBufferToBase64(spk.keyPair.pubKey),
                    // XXX: The InMemorySignalProtocolStore does not pass
                    // in or store the signature, but we need it when we
                    // publish out bundle and this method isn't called from
                    // within libsignal code, so we modify it to also store
                    // the signature.
                    'signature': u.arrayBufferToBase64(spk.signature)
                });
                return Promise.resolve();
            },

            removeSignedPreKey (key_id) {
                if (this.get('signed_prekey')['id'] === key_id) {
                    this.unset('signed_prekey');
                    this.save();
                }
                return Promise.resolve();
            },

            loadSession (identifier) {
                return Promise.resolve(this.get('session'+identifier));
            },

            storeSession (identifier, record) {
                return Promise.resolve(this.save('session'+identifier, record));
            },

            removeSession (identifier) {
                return Promise.resolve(this.unset('session'+identifier));
            },

            removeAllSessions (identifier) {
                const keys = Object.keys(this.attributes).filter(key => key.startsWith('session'+identifier) ? key : false);
                const attrs = {};
                keys.forEach(key => {attrs[key] = undefined});
                this.save(attrs);
                return Promise.resolve();
            },

            publishBundle () {
                const signed_prekey = this.get('signed_prekey');
                const node = `${Strophe.NS.OMEMO_BUNDLES}:${this.get('device_id')}`;
                const item = $build('item')
                    .c('bundle', {'xmlns': Strophe.NS.OMEMO})
                        .c('signedPreKeyPublic', {'signedPreKeyId': signed_prekey.id})
                            .t(signed_prekey.pubKey).up()
                        .c('signedPreKeySignature').t(signed_prekey.signature).up()
                        .c('identityKey').t(this.get('identity_keypair').pubKey).up()
                        .c('prekeys');

                Object.values(this.get('prekeys')).forEach((prekey, id) => item.c('preKeyPublic', {'preKeyId': id}).t(prekey.pubKey).up());
                const options = {'pubsub#access_model': 'open'};
                return api.pubsub.publish(null, node, item, options, false);
            },

            async generateMissingPreKeys () {
                const missing_keys = difference(
                    invokeMap(range(0, _converse.NUM_PREKEYS), Number.prototype.toString),
                    Object.keys(this.getPreKeys())
                );
                if (missing_keys.length < 1) {
                    log.warn("No missing prekeys to generate for our own device");
                    return Promise.resolve();
                }
                const keys = await Promise.all(missing_keys.map(id => libsignal.KeyHelper.generatePreKey(parseInt(id, 10))));
                keys.forEach(k => this.storePreKey(k.keyId, k.keyPair));
                const marshalled_keys = Object.keys(this.getPreKeys()).map(k => ({'id': k.keyId, 'key': u.arrayBufferToBase64(k.pubKey)}));
                const devicelist = _converse.devicelists.get(_converse.bare_jid);
                const device = devicelist.devices.get(this.get('device_id'));
                const bundle = await device.getBundle();
                device.save('bundle', Object.assign(bundle, {'prekeys': marshalled_keys}));
            },

            /**
             * Generate a the data used by the X3DH key agreement protocol
             * that can be used to build a session with a device.
             */
            async generateBundle () {
                // The first thing that needs to happen if a client wants to
                // start using OMEMO is they need to generate an IdentityKey
                // and a Device ID. The IdentityKey is a Curve25519 [6]
                // public/private Key pair. The Device ID is a randomly
                // generated integer between 1 and 2^31 - 1.
                const identity_keypair = await libsignal.KeyHelper.generateIdentityKeyPair();
                const bundle = {};
                const identity_key = u.arrayBufferToBase64(identity_keypair.pubKey);
                const device_id = generateDeviceID();

                bundle['identity_key'] = identity_key;
                bundle['device_id'] = device_id;
                this.save({
                    'device_id': device_id,
                    'identity_keypair': {
                        'privKey': u.arrayBufferToBase64(identity_keypair.privKey),
                        'pubKey': identity_key
                    },
                    'identity_key': identity_key
                });
                const signed_prekey = await libsignal.KeyHelper.generateSignedPreKey(identity_keypair, 0);

                _converse.omemo_store.storeSignedPreKey(signed_prekey);
                bundle['signed_prekey'] = {
                    'id': signed_prekey.keyId,
                    'public_key': u.arrayBufferToBase64(signed_prekey.keyPair.privKey),
                    'signature': u.arrayBufferToBase64(signed_prekey.signature)
                }
                const keys = await Promise.all(range(0, _converse.NUM_PREKEYS).map(id => libsignal.KeyHelper.generatePreKey(id)));
                keys.forEach(k => _converse.omemo_store.storePreKey(k.keyId, k.keyPair));
                const devicelist = _converse.devicelists.get(_converse.bare_jid);
                const device = await devicelist.devices.create({'id': bundle.device_id, 'jid': _converse.bare_jid}, {'promise': true});
                const marshalled_keys = keys.map(k => ({'id': k.keyId, 'key': u.arrayBufferToBase64(k.keyPair.pubKey)}));
                bundle['prekeys'] = marshalled_keys;
                device.save('bundle', bundle);
            },

            fetchSession () {
                if (this._setup_promise === undefined) {
                    this._setup_promise = new Promise((resolve, reject) => {
                        this.fetch({
                            'success': () => {
                                if (!_converse.omemo_store.get('device_id')) {
                                    this.generateBundle().then(resolve).catch(reject);
                                } else {
                                    resolve();
                                }
                            },
                            'error': (model, resp) => {
                                log.warn("Could not fetch OMEMO session from cache, we'll generate a new one.");
                                log.warn(resp);
                                this.generateBundle().then(resolve).catch(reject);
                            }
                        });
                    });
                }
                return this._setup_promise;
            }
        });

        /**
         * @class
         * @namespace _converse.Device
         * @memberOf _converse
         */
        _converse.Device = Model.extend({
            defaults: {
                'trusted': UNDECIDED,
                'active': true
            },

            getRandomPreKey () {
                // XXX: assumes that the bundle has already been fetched
                const bundle = this.get('bundle');
                return bundle.prekeys[u.getRandomInt(bundle.prekeys.length)];
            },

            async fetchBundleFromServer () {
                const stanza = $iq({
                    'type': 'get',
                    'from': _converse.bare_jid,
                    'to': this.get('jid')
                }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                    .c('items', {'node': `${Strophe.NS.OMEMO_BUNDLES}:${this.get('id')}`});

                let iq;
                try {
                    iq = await api.sendIQ(stanza)
                } catch (iq) {
                    log.error(`Could not fetch bundle for device ${this.get('id')} from ${this.get('jid')}`);
                    log.error(iq);
                    return null;
                }
                if (iq.querySelector('error')) {
                    throw new IQError("Could not fetch bundle", iq);
                }
                const publish_el = sizzle(`items[node="${Strophe.NS.OMEMO_BUNDLES}:${this.get('id')}"]`, iq).pop();
                const bundle_el = sizzle(`bundle[xmlns="${Strophe.NS.OMEMO}"]`, publish_el).pop();
                const bundle = parseBundle(bundle_el);
                this.save('bundle', bundle);
                return bundle;
            },

            /**
             * Fetch and save the bundle information associated with
             * this device, if the information is not cached already.
             * @method _converse.Device#getBundle
             */
            getBundle () {
                if (this.get('bundle')) {
                    return Promise.resolve(this.get('bundle'), this);
                } else {
                    return this.fetchBundleFromServer();
                }
            }
        });

        _converse.Devices = Collection.extend({
            model: _converse.Device,
        });

        /**
         * @class
         * @namespace _converse.DeviceList
         * @memberOf _converse
         */
        _converse.DeviceList = Model.extend({
            idAttribute: 'jid',

            initialize () {
                this.devices = new _converse.Devices();
                const id = `converse.devicelist-${_converse.bare_jid}-${this.get('jid')}`;
                this.devices.browserStorage = _converse.createStore(id);
                this.fetchDevices();

            },

            async onDevicesFound (collection) {
                if (collection.length === 0) {
                    let ids;
                    try {
                        ids = await this.fetchDevicesFromServer()
                    } catch (e) {
                        if (e === null) {
                            log.error(`Timeout error while fetching devices for ${this.get('jid')}`);
                        } else {
                            log.error(`Could not fetch devices for ${this.get('jid')}`);
                            log.error(e);
                        }
                        this.destroy();
                    }
                    if (this.get('jid') === _converse.bare_jid) {
                        await this.publishCurrentDevice(ids);
                    }
                }
            },

            fetchDevices () {
                if (this._devices_promise === undefined) {
                    this._devices_promise = new Promise(resolve => {
                        this.devices.fetch({
                            'success': c => resolve(this.onDevicesFound(c)),
                            'error': (m, e) => { log.error(e); resolve(); }
                        });
                    });
                }
                return this._devices_promise;
            },

            async getOwnDeviceId () {
                let device_id = _converse.omemo_store.get('device_id');
                if (!this.devices.findWhere({'id': device_id})) {
                    // Generate a new bundle if we cannot find our device
                    await _converse.omemo_store.generateBundle();
                    device_id = _converse.omemo_store.get('device_id');
                }
                return device_id;
            },

            async publishCurrentDevice (device_ids) {
                if (this.get('jid') !== _converse.bare_jid) {
                    return // We only publish for ourselves.
                }
                await restoreOMEMOSession();

                if (!_converse.omemo_store) {
                    // Happens during tests. The connection gets torn down
                    // before publishCurrentDevice has time to finish.
                    log.warn('publishCurrentDevice: omemo_store is not defined, likely a timing issue');
                    return;
                }
                if (!device_ids.includes(await this.getOwnDeviceId())) {
                    return this.publishDevices();
                }
            },

            async fetchDevicesFromServer () {
                const stanza = $iq({
                    'type': 'get',
                    'from': _converse.bare_jid,
                    'to': this.get('jid')
                }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                    .c('items', {'node': Strophe.NS.OMEMO_DEVICELIST});

                let iq;
                try {
                    iq = await api.sendIQ(stanza);
                } catch (e) {
                    log.error(e);
                    return [];
                }
                const selector = `list[xmlns="${Strophe.NS.OMEMO}"] device`;
                const device_ids = sizzle(selector, iq).map(d => d.getAttribute('id'));
                await Promise.all(
                    device_ids.map(id => this.devices.create({id, 'jid': this.get('jid')}, {'promise': true}))
                );
                return device_ids;
            },

            /**
             * Send an IQ stanza to the current user's "devices" PEP node to
             * ensure that all devices are published for potential chat partners to see.
             * See: https://xmpp.org/extensions/xep-0384.html#usecases-announcing
             */
            publishDevices () {
                const item = $build('item', {'id': 'current'}).c('list', {'xmlns': Strophe.NS.OMEMO})
                this.devices.filter(d => d.get('active')).forEach(d => item.c('device', {'id': d.get('id')}).up());
                const options = {'pubsub#access_model': 'open'};
                return api.pubsub.publish(null, Strophe.NS.OMEMO_DEVICELIST, item, options, false);
            },

            removeOwnDevices (device_ids) {
                if (this.get('jid') !== _converse.bare_jid) {
                    throw new Error("Cannot remove devices from someone else's device list");
                }
                device_ids.forEach(device_id => this.devices.get(device_id).destroy());
                return this.publishDevices();
            }
        });

        /**
         * @class
         * @namespace _converse.DeviceLists
         * @memberOf _converse
         */
        _converse.DeviceLists = Collection.extend({
            model: _converse.DeviceList,
            /**
             * Returns the {@link _converse.DeviceList} for a particular JID.
             * The device list will be created if it doesn't exist already.
             * @private
             * @method _converse.DeviceLists#getDeviceList
             * @param { String } jid - The Jabber ID for which the device list will be returned.
             */
            getDeviceList (jid) {
                return this.get(jid) || this.create({'jid': jid});
            }
        });

        /******************** Event Handlers ********************/
        api.waitUntil('chatBoxesInitialized').then(onChatBoxesInitialized);

        api.listen.on('parseMessage', parseEncryptedMessage);
        api.listen.on('parseMUCMessage', parseEncryptedMessage);

        api.listen.on('chatBoxViewInitialized', onChatInitialized);
        api.listen.on('chatRoomViewInitialized', onChatInitialized);

        api.listen.on('connected', registerPEPPushHandler);
        api.listen.on('getToolbarButtons', getOMEMOToolbarButton);

        api.listen.on('statusInitialized', initOMEMO);
        api.listen.on('addClientFeatures',
            () => api.disco.own.features.add(`${Strophe.NS.OMEMO_DEVICELIST}+notify`));

        api.listen.on('userDetailsModalInitialized', contact => {
            const jid = contact.get('jid');
            _converse.generateFingerprints(jid).catch(e => log.error(e));
        });

        api.listen.on('profileModalInitialized', () => {
            _converse.generateFingerprints(_converse.bare_jid).catch(e => log.error(e));
        });

        api.listen.on('afterTearDown', () => (delete _converse.omemo_store));

        api.listen.on('clearSession', () => {
            if (_converse.shouldClearCache() && _converse.devicelists) {
                _converse.devicelists.clearStore();
                delete _converse.devicelists;
            }
        });


        /************************ API ************************/
        Object.assign(_converse.api, {
            /**
             * The "omemo" namespace groups methods relevant to OMEMO
             * encryption.
             *
             * @namespace _converse.api.omemo
             * @memberOf _converse.api
             */
            'omemo': {
                /**
                 * The "bundle" namespace groups methods relevant to the user's
                 * OMEMO bundle.
                 *
                 * @namespace _converse.api.omemo.bundle
                 * @memberOf _converse.api.omemo
                 */
                'bundle': {
                    /**
                     * Lets you generate a new OMEMO device bundle
                     *
                     * @method _converse.api.omemo.bundle.generate
                     * @returns {promise} Promise which resolves once we have a result from the server.
                     */
                    'generate': async () => {
                        // Remove current device
                        const devicelist = _converse.devicelists.get(_converse.bare_jid);
                        const device_id = _converse.omemo_store.get('device_id');
                        if (device_id) {
                            const device = devicelist.devices.get(device_id);
                            _converse.omemo_store.unset(device_id);
                            if (device) {
                                await new Promise(done => device.destroy({'success': done, 'error': done}));
                            }
                            devicelist.devices.trigger('remove');
                        }
                        // Generate new device bundle and publish
                        // https://xmpp.org/extensions/attic/xep-0384-0.3.0.html#usecases-announcing
                        await _converse.omemo_store.generateBundle();
                        await devicelist.publishDevices();
                        const device = devicelist.devices.get(_converse.omemo_store.get('device_id'));
                        const fp = generateFingerprint(device);
                        await _converse.omemo_store.publishBundle();
                        return fp;
                    }
                }
            }
        });
    }
});
