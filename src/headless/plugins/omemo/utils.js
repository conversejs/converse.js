import sizzle from 'sizzle';
import log from '@converse/log';
import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import { constants, errors } from '../../shared/index.js';
import { initStorage } from '../../utils/storage.js';
import api from '../../shared/api/index.js';
import MUC from '../../plugins/muc/muc.js';
import { KEY_ALGO, TAG_LENGTH, UNTRUSTED } from './constants.js';
import DeviceLists from './devicelists.js';

const { u, Strophe, stx } = converse.env;
const { arrayBufferToHex, base64ToArrayBuffer } = u;

/**
 * @param {Element} stanza
 */
async function updateDevicesFromStanza(stanza) {
    const items_el = sizzle(`items[node="${Strophe.NS.OMEMO_DEVICELIST}"]`, stanza).pop();
    if (!items_el) return;

    const device_selector = `item list[xmlns="${Strophe.NS.OMEMO}"] device`;
    const device_ids = sizzle(device_selector, items_el).map((d) => d.getAttribute('id'));
    const jid = stanza.getAttribute('from');
    const devicelist = await api.omemo.devicelists.get(jid, true);
    const devices = devicelist.devices;
    const removed_ids = devices.pluck('id').filter(/** @param {string} id */ (id) => !device_ids.includes(id));

    const bare_jid = _converse.session.get('bare_jid');

    removed_ids.forEach(
        /** @param {string} id */ (id) => {
            if (jid === bare_jid && id === _converse.state.omemo_store.get('device_id')) {
                return; // We don't set the current device as inactive
            }
            devices.get(id).save('active', false);
        }
    );
    device_ids.forEach(
        /** @param {string} device_id */ (device_id) => {
            const device = devices.get(device_id);
            if (device) {
                device.save('active', true);
            } else {
                devices.create({ id: device_id, jid });
            }
        }
    );
    if (u.isSameBareJID(bare_jid, jid)) {
        // Make sure our own device is on the list
        // (i.e. if it was removed, add it again).
        devicelist.publishCurrentDevice(device_ids);
    }
}

/**
 * @param {Element} stanza
 */
async function updateBundleFromStanza(stanza) {
    const items_el = sizzle(`items`, stanza).pop();
    if (!items_el || !items_el.getAttribute('node').startsWith(Strophe.NS.OMEMO_BUNDLES)) {
        return;
    }
    const device_id = items_el.getAttribute('node').split(':')[1];
    const jid = stanza.getAttribute('from');
    const bundle_el = sizzle(`item > bundle`, items_el).pop();
    const devicelist = await api.omemo.devicelists.get(jid, true);
    const device = devicelist.devices.get(device_id) || devicelist.devices.create({ 'id': device_id, jid });
    const bundle = u.omemo.parseBundle(bundle_el);
    device.save({ bundle });
}

/**
 * @param {Element} message
 */
async function handlePEPPush(message) {
    try {
        if (sizzle(`event[xmlns="${Strophe.NS.PUBSUB}#event"]`, message).length) {
            await api.waitUntil('OMEMOInitialized');
            await updateDevicesFromStanza(message);
            await updateBundleFromStanza(message);
        }
    } catch (e) {
        log.error(e);
    }
}

/**
 * Register a pubsub handler for devices pushed from other connected clients
 */
export function registerPEPPushHandler() {
    api.connection.get().addHandler(
        /** @param {Element} message */
        (message) => {
            handlePEPPush(message);
            return true;
        },
        null,
        'message'
    );
}

async function fetchDeviceLists() {
    const bare_jid = _converse.session.get('bare_jid');

    _converse.state.devicelists = new DeviceLists();
    const id = `converse.devicelists-${bare_jid}`;
    initStorage(_converse.state.devicelists, id);
    await new Promise((resolve) => {
        _converse.state.devicelists.fetch({
            success: resolve,
            /**
             * @param {unknown} _m
             * @param {unknown} e
             */
            error: (_m, e) => {
                log.error(e);
                resolve();
            },
        });
    });
    // Call API method to wait for our own device list to be fetched from the
    // server or to be created. If we have no pre-existing OMEMO session, this
    // will cause a new device and bundle to be generated and published.
    await api.omemo.devicelists.get(bare_jid, true);
}

/**
 * @param {boolean} reconnecting
 */
export async function initOMEMO(reconnecting) {
    if (reconnecting) {
        return;
    }
    if (!_converse.state.config.get('trusted') || api.settings.get('clear_cache_on_logout')) {
        log.warn('Not initializing OMEMO, since this browser is not trusted or clear_cache_on_logout is set to true');
        return;
    }
    try {
        await fetchDeviceLists();
        await api.omemo.session.restore();
        await _converse.state.omemo_store.publishBundle();
    } catch (e) {
        log.error('Could not initialize OMEMO support');
        log.error(e);
        return;
    }
    /**
     * Triggered once OMEMO support has been initialized
     * @event _converse#OMEMOInitialized
     * @example _converse.api.listen.on('OMEMOInitialized', () => { ... });
     */
    api.trigger('OMEMOInitialized');
}

/**
 * @param {String} jid - The Jabber ID for which the device list will be returned.
 * @param {boolean} [create=false] - Set to `true` if the device list
 *      should be created if it cannot be found.
 */
export async function getDeviceList(jid, create = false) {
    const { devicelists } = _converse.state;
    const list = devicelists.get(jid) || (create ? devicelists.create({ jid }) : null);
    await list?.initialized;
    return list;
}

/**
 * @param {import('./device.js').default} device
 */
export async function generateFingerprint(device) {
    if (device.get('bundle')?.fingerprint) {
        return;
    }
    const bundle = await device.getBundle();
    bundle['fingerprint'] = arrayBufferToHex(base64ToArrayBuffer(bundle['identity_key']));
    device.save('bundle', bundle);
    device.trigger('change:bundle'); // Doesn't get triggered automatically due to pass-by-reference
}

/**
 * @param {Error|errors.IQError|errors.UserFacingError} e
 * @param {import('../../shared/chatbox.js').default} chat
 */
export function handleMessageSendError(e, chat) {
    const { __ } = _converse;
    if (e instanceof errors.IQError) {
        chat.save('omemo_supported', false);

        const err_msgs = [];
        if (sizzle(`presence-subscription-required[xmlns="${Strophe.NS.PUBSUB_ERROR}"]`, e.iq).length) {
            err_msgs.push(
                __(
                    "Sorry, we're unable to send an encrypted message because %1$s " +
                        'requires you to be subscribed to their presence in order to see their OMEMO information',
                    e.iq.getAttribute('from')
                )
            );
        } else if (sizzle(`remote-server-not-found[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]`, e.iq).length) {
            err_msgs.push(
                __(
                    "Sorry, we're unable to send an encrypted message because the remote server for %1$s could not be found",
                    e.iq.getAttribute('from')
                )
            );
        } else {
            err_msgs.push(__('Unable to send an encrypted message due to an unexpected error.'));
            err_msgs.push(e.iq.outerHTML);
        }
        api.alert('error', __('Error'), err_msgs);
    } else if (e instanceof errors.UserFacingError) {
        api.alert('error', __('Error'), [e.message]);
    }
    throw e;
}

/**
 * @param {string} jid
 * @returns {Promise<import('./devices.js').default>}
 */
export async function getDevicesForContact(jid) {
    await api.waitUntil('OMEMOInitialized');
    const devicelist = await api.omemo.devicelists.get(jid, true);
    await devicelist.fetchDevices();
    return devicelist.devices;
}

/**
 * @param {string} jid
 * @param {number} id
 */
export function getSessionCipher(jid, id) {
    const { libsignal } = /** @type import('./types').WindowWithLibsignal */ (window);
    const address = new libsignal.SignalProtocolAddress(jid, id);
    return new libsignal.SessionCipher(_converse.state.omemo_store, address);
}

/**
 * @param {ArrayBuffer} key_and_tag
 * @param {import('./device.js').default} device
 */
function encryptKey(key_and_tag, device) {
    return getSessionCipher(device.get('jid'), Number(device.get('id')))
        .encrypt(key_and_tag)
        .then(/** @param {ArrayBuffer} payload */ (payload) => ({ payload, device }));
}

/**
 * @param {import('./device.js').default} device
 */
async function buildSession(device) {
    const { libsignal } = /** @type import('./types').WindowWithLibsignal */ (window);
    const address = new libsignal.SignalProtocolAddress(device.get('jid'), device.get('id'));
    const sessionBuilder = new libsignal.SessionBuilder(_converse.state.omemo_store, address);
    const prekey = device.getRandomPreKey();
    const bundle = await device.getBundle();
    const device_id = device.get('id');

    return sessionBuilder.processPreKey({
        registrationId: typeof device_id === 'string' ? parseInt(device_id, 10) : device_id,
        identityKey: base64ToArrayBuffer(bundle.identity_key),
        signedPreKey: {
            keyId: bundle.signed_prekey.id, // <Number>
            publicKey: base64ToArrayBuffer(bundle.signed_prekey.public_key),
            signature: base64ToArrayBuffer(bundle.signed_prekey.signature),
        },
        preKey: {
            keyId: prekey.id, // <Number>
            publicKey: base64ToArrayBuffer(prekey.key),
        },
    });
}

/**
 * @param {import('./device.js').default} device
 */
export async function getSession(device) {
    if (!device.get('bundle')) {
        log.error(`Could not build an OMEMO session for device ${device.get('id')} because we don't have its bundle`);
        return null;
    }
    const { libsignal } = /** @type import('./types').WindowWithLibsignal */ (window);
    const address = new libsignal.SignalProtocolAddress(device.get('jid'), device.get('id'));
    const session = await _converse.state.omemo_store.loadSession(address.toString());
    if (session) {
        return session;
    } else {
        try {
            return await buildSession(device);
        } catch (e) {
            log.error(`Could not build an OMEMO session for device ${device.get('id')}`);
            log.error(e);
            return null;
        }
    }
}

/**
 * @param {import('../../shared/chatbox.js').default} chatbox
 * @returns {Promise<import('./device.js').default[]>}
 */
async function getBundlesAndBuildSessions(chatbox) {
    /**
     * @typedef {import('./device.js').default} Device
     */
    const { __ } = _converse;
    const no_devices_err = __('Sorry, no devices found to which we can send an OMEMO encrypted message.');
    let devices;
    if (chatbox instanceof MUC) {
        const collections = await Promise.all(
            chatbox.occupants.map(
                /** @param {import('../../plugins/muc/occupant').default} o */
                (o) => getDevicesForContact(o.get('jid'))
            )
        );
        devices = collections.reduce((a, b) => a.concat(b.models), []);
    } else if (chatbox.get('type') === constants.PRIVATE_CHAT_TYPE) {
        const their_devices = await getDevicesForContact(chatbox.get('jid'));
        if (their_devices.length === 0) {
            throw new errors.UserFacingError(no_devices_err);
        }
        const bare_jid = _converse.session.get('bare_jid');
        const own_list = await api.omemo.devicelists.get(bare_jid);
        const own_devices = own_list.devices;
        devices = [...own_devices.models, ...their_devices.models];
    }
    // Filter out our own device
    const id = _converse.state.omemo_store.get('device_id');
    devices = devices.filter(/** @param {Device} d */ (d) => d.get('id') !== id);

    // Fetch bundles if necessary
    await Promise.all(devices.map(/** @param {Device} d */ (d) => d.getBundle()));

    const sessions = await Promise.all(
        devices.map(
            /** @param {Device} [d] */ (d) => {
                return (d && getSession(d)) || null;
            }
        )
    );

    if (sessions.includes(null)) {
        // We couldn't build a session for certain devices.
        devices = devices.filter(/** @param {Device} d */ (d) => sessions[devices.indexOf(d)]);
        if (devices.length === 0) {
            throw new errors.UserFacingError(no_devices_err);
        }
    }
    return devices;
}

/**
 * @param {string} plaintext
 * @returns {Promise<import('./types').EncryptedMessage>}
 */
async function encryptMessage(plaintext) {
    // The client MUST use fresh, randomly generated key/IV pairs
    // with AES-128 in Galois/Counter Mode (GCM).

    // For GCM a 12 byte IV is strongly suggested as other IV lengths
    // will require additional calculations. In principle any IV size
    // can be used as long as the IV doesn't ever repeat. NIST however
    // suggests that only an IV size of 12 bytes needs to be supported
    // by implementations.
    //
    // https://crypto.stackexchange.com/questions/26783/ciphertext-and-tag-size-and-iv-transmission-with-aes-in-gcm-mode
    const iv = crypto.getRandomValues(new window.Uint8Array(12));
    const key = await crypto.subtle.generateKey(KEY_ALGO, true, ['encrypt', 'decrypt']);
    const algo = /** @type {AesGcmParams} */ {
        iv,
        name: 'AES-GCM',
        tagLength: TAG_LENGTH,
    };
    const encrypted = await crypto.subtle.encrypt(algo, key, u.stringToArrayBuffer(plaintext));
    const length = encrypted.byteLength - ((128 + 7) >> 3);
    const ciphertext = encrypted.slice(0, length);
    const tag = encrypted.slice(length);
    const exported_key = await crypto.subtle.exportKey('raw', key);
    return {
        tag,
        key: exported_key,
        key_and_tag: u.appendArrayBuffer(exported_key, tag),
        payload: u.arrayBufferToBase64(ciphertext),
        iv: u.arrayBufferToBase64(iv),
    };
}

/**
 * @param {import('./types').EncryptedMessage} obj
 * @returns {Promise<string>}
 */
export async function decryptMessage(obj) {
    const key_obj = await crypto.subtle.importKey('raw', obj.key, KEY_ALGO, true, ['encrypt', 'decrypt']);
    const cipher = u.appendArrayBuffer(u.base64ToArrayBuffer(obj.payload), obj.tag);
    const algo = /** @type {AesGcmParams} */ {
        name: 'AES-GCM',
        iv: u.base64ToArrayBuffer(obj.iv),
        tagLength: TAG_LENGTH,
    };
    return u.arrayBufferToString(await crypto.subtle.decrypt(algo, key_obj, cipher));
}

/**
 * @param {import('../../shared/chatbox.js').default} chat
 * @param {import('../../shared/types').MessageAndStanza} data
 * @return {Promise<import('../../shared/types').MessageAndStanza>}
 */
export async function createOMEMOMessageStanza(chat, data) {
    let { stanza } = data;
    const { message } = data;
    if (!message.get('is_encrypted')) {
        return data;
    }
    if (!message.get('body')) {
        throw new Error('No message body to encrypt!');
    }
    const devices = await getBundlesAndBuildSessions(chat);
    const { key_and_tag, iv, payload } = await encryptMessage(message.get('plaintext'));

    // The 16 bytes key and the GCM authentication tag (The tag
    // SHOULD have at least 128 bit) are concatenated and for each
    // intended recipient device, i.e. both own devices as well as
    // devices associated with the contact, the result of this
    // concatenation is encrypted using the corresponding
    // long-standing SignalProtocol session.
    const dicts = await Promise.all(
        devices
            .filter((device) => device.get('trusted') != UNTRUSTED && device.get('active'))
            .map((device) => encryptKey(key_and_tag, device))
    );

    // An encrypted header is added to the message for
    // each device that is supposed to receive it.
    // These headers simply contain the key that the
    // payload message is encrypted with,
    // and they are separately encrypted using the
    // session corresponding to the counterpart device.
    stanza
        .cnode(
            stx`
            <encrypted xmlns="${Strophe.NS.OMEMO}">
                <header sid="${_converse.state.omemo_store.get('device_id')}">
                    ${dicts.map(({ payload, device }) => {
                        const prekey = 3 == parseInt(payload.type, 10);
                        if (prekey) {
                            return stx`<key rid="${device.get('id')}" prekey="true">${btoa(payload.body)}</key>`;
                        }
                        return stx`<key rid="${device.get('id')}">${btoa(payload.body)}</key>`;
                    })}
                    <iv>${iv}</iv>
                </header>
                <payload>${payload}</payload>
            </encrypted>`
        )
        .root();

    stanza.cnode(stx`<store xmlns="${Strophe.NS.HINTS}"/>`).root();
    stanza.cnode(stx`<encryption xmlns="${Strophe.NS.EME}" namespace="${Strophe.NS.OMEMO}"/>`).root();
    return { message, stanza };
}

/**
 * @param {import('../../shared/chatbox.js').default} chat
 * @param {import('../../shared/types').MessageAttributes} attrs
 * @return {import('../../shared/types').MessageAttributes}
 */
export function getOutgoingMessageAttributes(chat, attrs) {
    const { __ } = _converse;
    if (chat.get('omemo_active') && attrs.body) {
        return {
            ...attrs,
            is_encrypted: true,
            plaintext: attrs.body,
            body: __(
                'This is an OMEMO encrypted message which your client doesn’t seem to support. ' +
                    'Find more information on https://conversations.im/omemo'
            ),
        };
    }
    return attrs;
}

/**
 * @param {string} jid
 */
export async function contactHasOMEMOSupport(jid) {
    /* Checks whether the contact advertises any OMEMO-compatible devices. */
    const devices = await u.omemo.getDevicesForContact(jid);
    return devices.length > 0;
}

/**
 * @param {import('../../shared/chatbox.js').default} chatbox
 */
async function checkOMEMOSupported(chatbox) {
    let supported;
    if (chatbox.get('type') === constants.CHATROOMS_TYPE) {
        await api.waitUntil('OMEMOInitialized');
        const { features } = /** @type {MUC} */ (chatbox);
        supported = features.get('nonanonymous') && features.get('membersonly');
    } else if (chatbox.get('type') === constants.PRIVATE_CHAT_TYPE) {
        supported = await contactHasOMEMOSupport(chatbox.get('jid'));
    }
    chatbox.set('omemo_supported', !!supported);
    if (supported && api.settings.get('omemo_default')) {
        chatbox.set('omemo_active', true);
    }
}

/**
 * @param {MUC} chatroom
 * @param {import('../../plugins/muc/occupant').default} occupant
 */
async function onOccupantAdded(chatroom, occupant) {
    if (occupant.isSelf() || !chatroom.features.get('nonanonymous') || !chatroom.features.get('membersonly')) {
        return;
    }
    const { __ } = _converse;
    if (chatroom.get('omemo_active')) {
        const supported = await contactHasOMEMOSupport(occupant.get('jid'));
        if (!supported) {
            chatroom.createMessage({
                'message': __(
                    "%1$s doesn't appear to have a client that supports OMEMO. " +
                        'Encrypted chat will no longer be possible in this grouchat.',
                    occupant.get('nick')
                ),
                'type': 'error',
            });
            chatroom.save({ 'omemo_active': false, 'omemo_supported': false });
        }
    }
}

/**
 * @param {import('../../shared/chatbox.js').default} chatbox
 */
export function onChatInitialized(chatbox) {
    checkOMEMOSupported(chatbox);
    if (chatbox.get('type') === constants.CHATROOMS_TYPE) {
        /** @type {MUC} */ (chatbox).occupants.on(
            'add',
            /** @param {import('../../plugins/muc/occupant').default} o */ (o) =>
                onOccupantAdded(/** @type {MUC} */ (chatbox), o)
        );
        /** @type {MUC} */ (chatbox).features.on('change', () => checkOMEMOSupported(chatbox));
    }
}

/**
 * @param {import('../../shared/message').default} message
 * @param {import('../../shared/types').FileUploadMessageAttributes} attrs
 */
export function setEncryptedFileURL(message, attrs) {
    if (message.file.xep454_ivkey) {
        const url = attrs.oob_url.replace(/^https?:/, 'aesgcm:') + '#' + message.file.xep454_ivkey;
        return {
            ...attrs,
            ...{
                oob_url: null, // Since only the body gets encrypted, we don't set the oob_url
                message: url,
                body: url,
            },
        };
    }
    return attrs;
}

/**
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function encryptFile(file) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await file.arrayBuffer());
    const exported_key = await window.crypto.subtle.exportKey('raw', key);
    const encrypted_file = new File([encrypted], file.name, { type: file.type, lastModified: file.lastModified });

    Object.assign(encrypted_file, { xep454_ivkey: arrayBufferToHex(iv) + arrayBufferToHex(exported_key) });
    return encrypted_file;
}

Object.assign(u, {
    omemo: {
        ...u.omemo,
        decryptMessage,
        encryptMessage,
        generateFingerprint,
        getDevicesForContact,
    },
});
