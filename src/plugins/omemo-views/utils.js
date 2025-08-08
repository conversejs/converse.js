/**
 * @typedef {module:plugins-omemo-index.WindowWithLibsignal} WindowWithLibsignal
 * @typedef {import('@converse/headless/shared/types').MessageAttributes} MessageAttributes
 * @typedef {import('@converse/headless/plugins/muc/types').MUCMessageAttributes} MUCMessageAttributes
 * @typedef {import('@converse/headless').ChatBox} ChatBox
 * @typedef {import('@converse/headless/types/shared/message').default} BaseMessage
 */
import { html } from 'lit';
import { __ } from 'i18n';
import { until } from 'lit/directives/until.js';
import { _converse, api, log, u, constants } from '@converse/headless';
import tplAudio from 'shared/texture/templates/audio.js';
import tplFile from 'templates/file.js';
import tplImage from 'shared/texture/templates/image.js';
import tplVideo from 'shared/texture/templates/video.js';
import { MIMETYPES_MAP } from 'utils/file.js';
import { getFileName } from 'utils/html.js';

const { CHATROOMS_TYPE } = constants;
const { hexToArrayBuffer, isAudioURL, isError, isImageURL, isVideoURL } = u;

/**
 * @param {string} fp
 */
export function formatFingerprint(fp) {
    fp = fp.replace(/^05/, '');
    for (let i = 1; i < 8; i++) {
        const idx = i * 8 + i - 1;
        fp = fp.slice(0, idx) + ' ' + fp.slice(idx);
    }
    return fp;
}

/**
 * @param {string} fp
 */
export function formatFingerprintForQRCode(fp) {
    const sid = _converse.state.omemo_store.get('device_id');
    const jid = _converse.session.get('bare_jid');
    fp = fp.replace(/^05/, '');
    return `xmpp:${jid}?omemo-sid-${sid}=${fp}`;
}

/**
 * @param {string} iv
 * @param {string} key
 * @param {ArrayBuffer} cipher
 */
async function decryptFile(iv, key, cipher) {
    const key_obj = await crypto.subtle.importKey('raw', hexToArrayBuffer(key), 'AES-GCM', false, ['decrypt']);
    const algo = /** @type {AesGcmParams} */ {
        name: 'AES-GCM',
        iv: hexToArrayBuffer(iv),
    };
    return crypto.subtle.decrypt(algo, key_obj, cipher);
}

/**
 * @param {string} url
 * @returns {Promise<ArrayBuffer|null>}
 */
async function downloadFile(url) {
    let response;
    try {
        response = await fetch(url);
    } catch (e) {
        log.error(`${e.name}: Failed to download encrypted media: ${url}`);
        log.error(e);
        return null;
    }

    if (response.status >= 200 && response.status < 400) {
        return response.arrayBuffer();
    }
}

/**
 * @param {string} url_text
 * @returns {Promise<string|Error|null>}
 */
async function getAndDecryptFile(url_text) {
    const url = new URL(url_text);
    const protocol = window.location.hostname === 'localhost' && url.hostname === 'localhost' ? 'http' : 'https';
    const http_url = url.toString().replace(/^aesgcm/, protocol);
    const cipher = await downloadFile(http_url);
    if (cipher === null) {
        log.error(`Could not decrypt a received encrypted file ${url.toString()} since it could not be downloaded`);
        return new Error(__('Error: could not decrypt a received encrypted file, because it could not be downloaded'));
    }

    const hash = url.hash.slice(1);
    const key = hash.substring(hash.length - 64);
    const iv = hash.replace(key, '');
    let content;
    try {
        content = await decryptFile(iv, key, cipher);
    } catch (e) {
        log.error(`Could not decrypt file ${url.toString()}`);
        log.error(e);
        return null;
    }
    const [filename, extension] = url.pathname.split('/').pop().split('.');
    const mimetype = MIMETYPES_MAP[extension];
    try {
        const file = new File([content], filename, { 'type': mimetype });
        return URL.createObjectURL(file);
    } catch (e) {
        log.error(`Could not decrypt file ${url.toString()}`);
        log.error(e);
        return null;
    }
}

/**
 * @param {string} file_url
 * @param {string|Error} obj_url
 * @param {import('shared/texture/texture.js').Texture} richtext
 * @returns {import("lit").TemplateResult}
 */
function getTemplateForObjectURL(file_url, obj_url, richtext) {
    if (isError(obj_url)) {
        return html`<p class="error">${/** @type {Error} */ (obj_url).message}</p>`;
    }

    if (isImageURL(file_url)) {
        return tplImage({
            src: obj_url,
            onClick: richtext.onImgClick,
            onLoad: richtext.onImgLoad,
        });
    } else if (isAudioURL(file_url)) {
        return tplAudio(/** @type {string} */ (obj_url));
    } else if (isVideoURL(file_url)) {
        return tplVideo(/** @type {string} */ (obj_url));
    } else {
        return tplFile(obj_url, getFileName(file_url));
    }
}

/**
 * @param {string} text
 * @param {number} offset
 * @param {import('shared/texture/texture.js').Texture} richtext
 */
function addEncryptedFiles(text, offset, richtext) {
    const objs = [];
    try {
        const parse_options = { start: /\b(aesgcm:\/\/)/gi };
        u.withinString(
            text,
            /**
             * @param {string} url
             * @param {number} start
             * @param {number} end
             */
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
    objs.forEach((o) => {
        const promise = getAndDecryptFile(o.url).then((obj_url) => getTemplateForObjectURL(o.url, obj_url, richtext));

        const template = html`${until(promise, '')}`;
        richtext.addTemplateResult(o.start + offset, o.end + offset, template);
    });
}

/**
 * @param {import('shared/texture/texture.js').Texture} richtext
 */
export function handleEncryptedFiles(richtext) {
    if (!_converse.state.config.get('trusted')) {
        return;
    }
    richtext.addAnnotations(
        /**
         * @param {string} text
         * @param {number} offset
         */
        (text, offset) => addEncryptedFiles(text, offset, richtext)
    );
}

export function onChatComponentInitialized(el) {
    el.listenTo(el.model.messages, 'add', (message) => {
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

/**
 * @param {string} jid
 */
export async function generateFingerprints(jid) {
    const devices = await u.omemo.getDevicesForContact(jid);
    return Promise.all(devices.map((d) => u.omemo.generateFingerprint(d)));
}

/**
 * @param {string} jid
 * @param {string} device_id
 * @returns {Promise<import('@converse/headless').Device[]>}
 */
export async function getDeviceForContact(jid, device_id) {
    const devices = await u.omemo.getDevicesForContact(jid);
    return devices.get(device_id);
}

/**
 * @param {MouseEvent} ev
 */
function toggleOMEMO(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    const toolbar_el = u.ancestor(ev.target, 'converse-chat-toolbar');
    if (!toolbar_el.model.get('omemo_supported')) {
        let messages;
        if (toolbar_el.model.get('type') === CHATROOMS_TYPE) {
            messages = [
                __(
                    'Cannot use end-to-end encryption in this groupchat, ' +
                        'either the groupchat has some anonymity or not all participants support OMEMO.'
                ),
            ];
        } else {
            messages = [
                __(
                    "Cannot use end-to-end encryption because %1$s uses a client that doesn't support OMEMO.",
                    toolbar_el.model.contact.getDisplayName()
                ),
            ];
        }
        return api.alert('error', __('Error'), messages);
    }
    toolbar_el.model.save({ 'omemo_active': !toolbar_el.model.get('omemo_active') });
}

/**
 * @param {import('shared/chat/toolbar').ChatToolbar} toolbar_el
 * @param {Array<import('lit').TemplateResult>} buttons
 */
export function getOMEMOToolbarButton(toolbar_el, buttons) {
    const model = toolbar_el.model;
    const is_muc = model.get('type') === CHATROOMS_TYPE;
    let title;
    if (model.get('omemo_supported')) {
        const i18n_plaintext = __('Messages are being sent in plaintext');
        const i18n_encrypted = __('Messages are sent encrypted');
        title = model.get('omemo_active') ? i18n_encrypted : i18n_plaintext;
    } else if (is_muc) {
        title = __(
            'This groupchat needs to be members-only and non-anonymous in ' +
                'order to support OMEMO encrypted messages'
        );
    } else {
        title = __('OMEMO encryption is not supported');
    }

    let color;
    if (model.get('omemo_supported')) {
        if (model.get('omemo_active')) {
            color = is_muc ? `var(--muc-color)` : `var(--chat-color)`;
        } else {
            color = `var(--error-color)`;
        }
    } else {
        color = `var(--disabled-color)`;
    }
    buttons.push(html`
        <button
            type="button"
            class="btn toggle-omemo"
            title="${title}"
            data-disabled=${!model.get('omemo_supported')}
            @click=${toggleOMEMO}
        >
            <converse-icon
                class="fa ${model.get('omemo_active') ? `fa-lock` : `fa-unlock`}"
                path-prefix="${api.settings.get('assets_path')}"
                size="1em"
                color="${color}"
            ></converse-icon>
        </button>
    `);
    return buttons;
}

Object.assign(u, {
    omemo: {
        ...u.omemo,
        formatFingerprint,
    },
});
