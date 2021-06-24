/* global libsignal */
import URI from 'urijs';
import difference from 'lodash-es/difference';
import log from '@converse/headless/log';
import tpl_audio from 'templates/audio.js';
import tpl_file from 'templates/file.js';
import tpl_image from 'templates/image.js';
import tpl_video from 'templates/video.js';
import { __ } from 'i18n';
import { _converse, converse, api } from '@converse/headless/core';
import { html } from 'lit';
import { initStorage } from '@converse/headless/shared/utils.js';
import { isAudioURL, isImageURL, isVideoURL, getURI } from 'utils/html.js';
import { until } from 'lit/directives/until.js';
import { MIMETYPES_MAP } from 'utils/file.js';
import {
    appendArrayBuffer,
    arrayBufferToBase64,
    arrayBufferToHex,
    arrayBufferToString,
    base64ToArrayBuffer,
    hexToArrayBuffer,
    stringToArrayBuffer
} from '@converse/headless/utils/arraybuffer.js';

const { Strophe, sizzle, u } = converse.env;

const TAG_LENGTH = 128;
const KEY_ALGO = {
    'name': 'AES-GCM',
    'length': 128
};

export const omemo = {
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
            key = await crypto.subtle.generateKey(KEY_ALGO, true, ['encrypt', 'decrypt']),
            algo = {
                'name': 'AES-GCM',
                'iv': iv,
                'tagLength': TAG_LENGTH
            },
            encrypted = await crypto.subtle.encrypt(algo, key, stringToArrayBuffer(plaintext)),
            length = encrypted.byteLength - ((128 + 7) >> 3),
            ciphertext = encrypted.slice(0, length),
            tag = encrypted.slice(length),
            exported_key = await crypto.subtle.exportKey('raw', key);

        return {
            'key': exported_key,
            'tag': tag,
            'key_and_tag': appendArrayBuffer(exported_key, tag),
            'payload': arrayBufferToBase64(ciphertext),
            'iv': arrayBufferToBase64(iv)
        };
    },

    async decryptMessage (obj) {
        const key_obj = await crypto.subtle.importKey('raw', obj.key, KEY_ALGO, true, ['encrypt', 'decrypt']);
        const cipher = appendArrayBuffer(base64ToArrayBuffer(obj.payload), obj.tag);
        const algo = {
            'name': 'AES-GCM',
            'iv': base64ToArrayBuffer(obj.iv),
            'tagLength': TAG_LENGTH
        };
        return arrayBufferToString(await crypto.subtle.decrypt(algo, key_obj, cipher));
    }
}

async function decryptFile (iv, key, cipher) {
    const key_obj = await crypto.subtle.importKey('raw', hexToArrayBuffer(key), 'AES-GCM', false, ['decrypt']);
    const algo = {
        'name': 'AES-GCM',
        'iv': hexToArrayBuffer(iv),
    };
    return crypto.subtle.decrypt(algo, key_obj, cipher);
}

async function downloadFile(url) {
    let response;
    try {
        response = await fetch(url)
    } catch(e) {
        log.error(`Failed to download encrypted media: ${url}`);
        log.error(e);
        return null;
    }

    if (response.status >= 200 && response.status < 400) {
        return response.arrayBuffer();
    }
}

async function getAndDecryptFile (uri) {
    const hash = uri.hash().slice(1);
    const protocol = window.location.hostname === 'localhost' ? 'http' : 'https';
    const http_url = uri.toString().replace(/^aesgcm/, protocol);
    const cipher = await downloadFile(http_url);
    const iv = hash.slice(0, 24);
    const key = hash.slice(24);
    let content;
    try {
        content = await decryptFile(iv, key, cipher);
    } catch (e) {
        log.error(`Could not decrypt file ${uri.toString()}`);
        log.error(e);
        return null;
    }
    const [filename, extension] = uri.filename()?.split('.');
    const mimetype = MIMETYPES_MAP[extension];
    try {
        const file = new File([content], filename, { 'type': mimetype });
        return URL.createObjectURL(file);
    } catch (e) {
        log.error(`Could not decrypt file ${uri.toString()}`);
        log.error(e);
        return null;
    }
}

function getTemplateForObjectURL (uri, obj_url, richtext) {
    const file_url = uri.toString();
    if (obj_url === null) {
        return file_url;
    }
    if (isImageURL(file_url)) {
        return tpl_image({
            'url': obj_url,
            'onClick': richtext.onImgClick,
            'onLoad': richtext.onImgLoad
        });
    } else if (isAudioURL(file_url)) {
        return tpl_audio(obj_url);
    } else if (isVideoURL(file_url)) {
        return tpl_video(obj_url);
    } else {
        return tpl_file(obj_url, uri.filename());
    }

}

function addEncryptedFiles(text, offset, richtext) {
    const objs = [];
    try {
        const parse_options = { 'start': /\b(aesgcm:\/\/)/gi };
        URI.withinString(
            text,
            (url, start, end) => {
                objs.push({ url, start, end });
                return url;
            },
            parse_options
        );
    } catch (error) {
        log.debug(error);
        return;
    }
    objs.forEach(o => {
        const uri = getURI(text.slice(o.start, o.end));
        const promise = getAndDecryptFile(uri)
            .then(obj_url => getTemplateForObjectURL(uri, obj_url, richtext));
        const template = html`${until(promise, '')}`;
        richtext.addTemplateResult(o.start + offset, o.end + offset, template);
    });
}

export function handleEncryptedFiles (richtext) {
    if (!_converse.config.get('trusted')) {
        return;
    }
    richtext.addAnnotations((text, offset) => addEncryptedFiles(text, offset, richtext));
}

export function parseEncryptedMessage (stanza, attrs) {
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

export function onChatBoxesInitialized () {
    _converse.chatboxes.on('add', chatbox => {
        checkOMEMOSupported(chatbox);
        if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
            chatbox.occupants.on('add', o => onOccupantAdded(chatbox, o));
            chatbox.features.on('change', () => checkOMEMOSupported(chatbox));
        }
    });
}

export function onChatInitialized (el) {
    el.listenTo(el.model.messages, 'add', message => {
        if (message.get('is_encrypted') && !message.get('is_error')) {
            el.model.save('omemo_supported', true);
        }
    });
    el.listenTo(el.model, 'change:omemo_supported', () => {
        if (!el.model.get('omemo_supported') && el.model.get('omemo_active')) {
            el.model.set('omemo_active', false);
        } else {
            // Manually trigger an update, setting omemo_active to
            // false above will automatically trigger one.
            el.querySelector('converse-chat-toolbar')?.requestUpdate();
        }
    });
    el.listenTo(el.model, 'change:omemo_active', () => {
        el.querySelector('converse-chat-toolbar').requestUpdate();
    });
}

export function getSessionCipher (jid, id) {
    const address = new libsignal.SignalProtocolAddress(jid, id);
    return new window.libsignal.SessionCipher(_converse.omemo_store, address);
}

async function handleDecryptedWhisperMessage (attrs, key_and_tag) {
    const encrypted = attrs.encrypted;
    const devicelist = _converse.devicelists.getDeviceList(attrs.from);
    await devicelist._devices_promise;

    let device = devicelist.get(encrypted.device_id);
    if (!device) {
        device = await devicelist.devices.create({ 'id': encrypted.device_id, 'jid': attrs.from }, { 'promise': true });
    }
    if (encrypted.payload) {
        const key = key_and_tag.slice(0, 16);
        const tag = key_and_tag.slice(16);
        const result = await omemo.decryptMessage(Object.assign(encrypted, { 'key': key, 'tag': tag }));
        device.save('active', true);
        return result;
    }
}

function getDecryptionErrorAttributes (e) {
    if (api.settings.get('loglevel') === 'debug') {
        return {
            'error_text':
                __('Sorry, could not decrypt a received OMEMO message due to an error.') + ` ${e.name} ${e.message}`,
            'error_type': 'Decryption',
            'is_ephemeral': true,
            'is_error': true,
            'type': 'error'
        };
    } else {
        return {};
    }
}

async function decryptPrekeyWhisperMessage (attrs) {
    const session_cipher = getSessionCipher(attrs.from, parseInt(attrs.encrypted.device_id, 10));
    const key = base64ToArrayBuffer(attrs.encrypted.key);
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
            return Object.assign(attrs, { 'plaintext': plaintext });
        } else {
            return Object.assign(attrs, { 'is_only_key': true });
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
            'type': 'error'
        });
    }
    const session_cipher = getSessionCipher(from_jid, parseInt(attrs.encrypted.device_id, 10));
    const key = base64ToArrayBuffer(attrs.encrypted.key);
    try {
        const key_and_tag = await session_cipher.decryptWhisperMessage(key, 'binary');
        const plaintext = await handleDecryptedWhisperMessage(attrs, key_and_tag);
        return Object.assign(attrs, { 'plaintext': plaintext });
    } catch (e) {
        log.error(`${e.name} ${e.message}`);
        return Object.assign(attrs, getDecryptionErrorAttributes(e));
    }
}

export function addKeysToMessageStanza (stanza, dicts, iv) {
    for (const i in dicts) {
        if (Object.prototype.hasOwnProperty.call(dicts, i)) {
            const payload = dicts[i].payload;
            const device = dicts[i].device;
            const prekey = 3 == parseInt(payload.type, 10);

            stanza.c('key', { 'rid': device.get('id') }).t(btoa(payload.body));
            if (prekey) {
                stanza.attrs({ 'prekey': prekey });
            }
            stanza.up();
            if (i == dicts.length - 1) {
                stanza
                    .c('iv')
                    .t(iv)
                    .up()
                    .up();
            }
        }
    }
    return Promise.resolve(stanza);
}

/**
 * Given an XML element representing a user's OMEMO bundle, parse it
 * and return a map.
 */
export function parseBundle (bundle_el) {
    const signed_prekey_public_el = bundle_el.querySelector('signedPreKeyPublic');
    const signed_prekey_signature_el = bundle_el.querySelector('signedPreKeySignature');
    const prekeys = sizzle(`prekeys > preKeyPublic`, bundle_el).map(el => ({
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
    };
}

export async function generateFingerprint (device) {
    if (device.get('bundle')?.fingerprint) {
        return;
    }
    const bundle = await device.getBundle();
    bundle['fingerprint'] = arrayBufferToHex(base64ToArrayBuffer(bundle['identity_key']));
    device.save('bundle', bundle);
    device.trigger('change:bundle'); // Doesn't get triggered automatically due to pass-by-reference
}

export async function getDevicesForContact (jid) {
    await api.waitUntil('OMEMOInitialized');
    const devicelist = _converse.devicelists.get(jid) || _converse.devicelists.create({ 'jid': jid });
    await devicelist.fetchDevices();
    return devicelist.devices;
}

export function generateDeviceID () {
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
            throw new Error('Unable to generate a unique device ID');
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
        'identityKey': base64ToArrayBuffer(bundle.identity_key),
        'signedPreKey': {
            'keyId': bundle.signed_prekey.id, // <Number>
            'publicKey': base64ToArrayBuffer(bundle.signed_prekey.public_key),
            'signature': base64ToArrayBuffer(bundle.signed_prekey.signature)
        },
        'preKey': {
            'keyId': prekey.id, // <Number>
            'publicKey': base64ToArrayBuffer(prekey.key)
        }
    });
}

export async function getSession (device) {
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
    const device = devicelist.devices.get(device_id) || devicelist.devices.create({ 'id': device_id, 'jid': jid });
    device.save({ 'bundle': parseBundle(bundle_el) });
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
            return; // We don't set the current device as inactive
        }
        devices.get(id).save('active', false);
    });
    device_ids.forEach(device_id => {
        const device = devices.get(device_id);
        if (device) {
            device.save('active', true);
        } else {
            devices.create({ 'id': device_id, 'jid': jid });
        }
    });
    if (u.isSameBareJID(jid, _converse.bare_jid)) {
        // Make sure our own device is on the list
        // (i.e. if it was removed, add it again).
        devicelist.publishCurrentDevice(device_ids);
    }
}

export function registerPEPPushHandler () {
    // Add a handler for devices pushed from other connected clients
    _converse.connection.addHandler(
        message => {
            try {
                if (sizzle(`event[xmlns="${Strophe.NS.PUBSUB}#event"]`, message).length) {
                    updateDevicesFromStanza(message);
                    updateBundleFromStanza(message);
                }
            } catch (e) {
                log.error(e.message);
            }
            return true;
        },
        null,
        'message',
        'headline'
    );
}

export function restoreOMEMOSession () {
    if (_converse.omemo_store === undefined) {
        const id = `converse.omemosession-${_converse.bare_jid}`;
        _converse.omemo_store = new _converse.OMEMOStore({ id });
        initStorage(_converse.omemo_store, id);
    }
    return _converse.omemo_store.fetchSession();
}

function fetchDeviceLists () {
    return new Promise((success, error) => _converse.devicelists.fetch({ success, 'error': (m, e) => error(e) }));
}

async function fetchOwnDevices () {
    await fetchDeviceLists();
    let own_devicelist = _converse.devicelists.get(_converse.bare_jid);
    if (own_devicelist) {
        own_devicelist.fetchDevices();
    } else {
        own_devicelist = await _converse.devicelists.create({ 'jid': _converse.bare_jid }, { 'promise': true });
    }
    return own_devicelist._devices_promise;
}

export async function initOMEMO () {
    if (!_converse.config.get('trusted') || api.settings.get('clear_cache_on_logout')) {
        log.warn('Not initializing OMEMO, since this browser is not trusted or clear_cache_on_logout is set to true');
        return;
    }
    _converse.devicelists = new _converse.DeviceLists();
    const id = `converse.devicelists-${_converse.bare_jid}`;
    initStorage(_converse.devicelists, id);
    try {
        await fetchOwnDevices();
        await restoreOMEMOSession();
        await _converse.omemo_store.publishBundle();
    } catch (e) {
        log.error('Could not initialize OMEMO support');
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
                'message': __(
                    "%1$s doesn't appear to have a client that supports OMEMO. " +
                        'Encrypted chat will no longer be possible in this grouchat.',
                    occupant.get('nick')
                ),
                'type': 'error'
            });
            chatroom.save({ 'omemo_active': false, 'omemo_supported': false });
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
            messages = [
                __(
                    'Cannot use end-to-end encryption in this groupchat, ' +
                        'either the groupchat has some anonymity or not all participants support OMEMO.'
                )
            ];
        } else {
            messages = [
                __(
                    "Cannot use end-to-end encryption because %1$s uses a client that doesn't support OMEMO.",
                    toolbar_el.model.contact.getDisplayName()
                )
            ];
        }
        return api.alert('error', __('Error'), messages);
    }
    toolbar_el.model.save({ 'omemo_active': !toolbar_el.model.get('omemo_active') });
}

export function getOMEMOToolbarButton (toolbar_el, buttons) {
    const model = toolbar_el.model;
    const is_muc = model.get('type') === _converse.CHATROOMS_TYPE;
    let title;
    if (is_muc && model.get('omemo_supported')) {
        const i18n_plaintext = __('Messages are being sent in plaintext');
        const i18n_encrypted = __('Messages are sent encrypted');
        title = model.get('omemo_active') ? i18n_encrypted : i18n_plaintext;
    } else {
        title = __(
            'This groupchat needs to be members-only and non-anonymous in ' +
                'order to support OMEMO encrypted messages'
        );
    }

    buttons.push(html`
        <button class="toggle-omemo" title="${title}" ?disabled=${!model.get('omemo_supported')} @click=${toggleOMEMO}>
            <converse-icon
                class="fa ${model.get('omemo_active') ? `fa-lock` : `fa-unlock`}"
                path-prefix="${api.settings.get('assets_path')}"
                size="1em"
                color="${model.get('omemo_active') ? `var(--info-color)` : `var(--error-color)`}"
            ></converse-icon>
        </button>
    `);
    return buttons;
}
