/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * XEP-0363 HTTP File Upload as a standalone helper: discover the upload service,
 * request a slot, and PUT the file, resolving to the resulting public GET URL.
 *
 * Chat's {@link BaseMessage} carries its own copy of this flow, coupled to a message
 * model. This module extracts the protocol so non-chat consumers (e.g. the Social
 * composer) can upload a file without a chat/chatbox. A future refactor could route
 * the Message model through here to de-duplicate.
 */
import sizzle from 'sizzle';
import { Strophe } from 'strophe.js';
import log from '@converse/log';
import _converse from './_converse.js';
import api from './api/index.js';
import converse from './api/public.js';

const { stx } = converse.env;

/**
 * @typedef {Object} UploadedFile
 * @property {string} url - The public GET URL of the uploaded file.
 * @property {string} name - The original filename.
 * @property {string} type - The file's MIME type.
 * @property {number} size - The file's size in bytes.
 */

/**
 * @typedef {Object} UploadService
 * @property {string} slot_request_url - The upload component's JID (slot-request target).
 * @property {number} max_file_size - Max allowed size in bytes (Infinity if unadvertised).
 */

/**
 * Discover the HTTP-Upload service (XEP-0363 § 3) advertised by `domain`.
 * @param {string} [domain] - Defaults to our own server's domain.
 * @returns {Promise<UploadService|null>} `null` when the server offers no upload service.
 */
export async function getUploadService(domain) {
    domain = domain || _converse.session.get('domain');
    const items = await api.disco.features.get(Strophe.NS.HTTPUPLOAD, domain);
    const item = items.pop();
    if (!item?.id) return null;

    const data = item.dataforms?.where({ FORM_TYPE: { value: Strophe.NS.HTTPUPLOAD, type: 'hidden' } }).pop();
    const max = parseInt((data?.attributes || {})['max-file-size']?.value, 10);
    return { slot_request_url: item.id, max_file_size: isNaN(max) ? Infinity : max };
}

/**
 * Request an upload slot for `file` (XEP-0363 § 4).
 * @param {File} file
 * @param {string} slot_request_url
 * @returns {Promise<{ get: string, put: string, headers: Array<{name: string, value: string}> }>}
 */
async function requestSlot(file, slot_request_url) {
    const iq = stx`
        <iq from="${_converse.session.get('jid')}"
            to="${slot_request_url}"
            type="get"
            xmlns="jabber:client">
            <request xmlns="${Strophe.NS.HTTPUPLOAD}"
                     filename="${file.name}"
                     size="${file.size}"
                     content-type="${file.type}"></request>
        </iq>`;
    const stanza = await api.sendIQ(iq);
    const slot = sizzle(`slot[xmlns="${Strophe.NS.HTTPUPLOAD}"]`, stanza).pop();
    if (!slot) throw new Error('The upload service returned no slot');
    // Only Authorization/Expires can be set from JS (Cookie can't); mirror what the
    // chat upload path forwards (see BaseMessage.getUploadRequestMetadata).
    const headers = sizzle('put header', slot)
        .map((h) => ({ name: h.getAttribute('name'), value: h.textContent }))
        .filter((h) => ['Authorization', 'Expires'].includes(h.name));
    return {
        get: slot.querySelector('get').getAttribute('url'),
        put: slot.querySelector('put').getAttribute('url'),
        headers,
    };
}

/**
 * PUT `file` to the slot's put URL (XEP-0363 § 5).
 * @param {File} file
 * @param {{ put: string, headers: Array<{name: string, value: string}> }} slot
 * @param {(fraction: number) => void} [onProgress]
 * @returns {Promise<void>}
 */
function putFile(file, slot, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== XMLHttpRequest.DONE) return;
            if (xhr.status === 200 || xhr.status === 201) resolve();
            else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
        };
        if (onProgress) {
            xhr.upload.addEventListener('progress', (evt) => {
                if (evt.lengthComputable) onProgress(evt.loaded / evt.total);
            });
        }
        xhr.onerror = () => reject(new Error('The file upload failed'));
        xhr.open('PUT', slot.put, true);
        xhr.setRequestHeader('Content-type', file.type);
        slot.headers.forEach((h) => xhr.setRequestHeader(h.name, h.value));
        xhr.send(file);
    });
}

/**
 * Upload `file` via XEP-0363 and resolve to its public URL plus metadata.
 * @param {File} file
 * @param {object} [opts]
 * @param {string} [opts.domain] - Upload service host (defaults to our own domain).
 * @param {(fraction: number) => void} [opts.onProgress] - Upload progress (0..1).
 * @returns {Promise<UploadedFile>}
 * @throws when no service is available, the file is too large, or the PUT fails.
 */
export async function uploadFile(file, { domain, onProgress } = {}) {
    const service = await getUploadService(domain);
    if (!service) throw new Error('No HTTP file upload service is available');
    if (file.size > service.max_file_size) throw new Error('The file is too large to upload');

    const slot = await requestSlot(file, service.slot_request_url);
    await putFile(file, slot, onProgress);
    log.info(`http-upload: uploaded ${file.name} -> ${slot.get}`);
    return { url: slot.get, name: file.name, type: file.type, size: file.size };
}
