/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * XEP-0363 HTTP File Upload: discover the upload service, request a slot, and PUT the
 * file.
 *
 * Two ways in. {@link uploadFile} does the whole flow and resolves to the public GET
 * URL, which is what a consumer without a chat wants (the Social composer). Chat instead
 * drives {@link requestSlot} and {@link putFile} itself, because it has to record the
 * slot URLs and the progress on a message model as it goes, and reports failures as
 * messages in the conversation rather than as exceptions.
 */
import sizzle from 'sizzle';
import { Strophe } from 'strophe.js';
import log from '@converse/log';
import _converse from './_converse.js';
import api from './api/index.js';
import converse from './api/public.js';

const { stx } = converse.env;

/**
 * Discover the HTTP-Upload service (XEP-0363 § 3) advertised by `domain`.
 * @param {string} [domain] - Defaults to our own server's domain.
 * @returns {Promise<import('./types').UploadService|null>} `null` when the server offers
 *      no upload service.
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
 * The `code` on the error {@link requestSlot} throws when the service answered, but with
 * no slot in it. Distinguishable from the IQ itself failing, which the chat upload path
 * reports differently.
 */
export const NO_SLOT = 'no-slot';

/**
 * Request an upload slot for `file` (XEP-0363 § 4).
 * @param {File} file
 * @param {string} slot_request_url
 * @returns {Promise<import('./types').UploadSlot>}
 * @throws The IQ error on failure, or an `Error` with `code === NO_SLOT` if the response
 *      carried no slot.
 */
export async function requestSlot(file, slot_request_url) {
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
    if (!slot) throw Object.assign(new Error('The upload service returned no slot'), { code: NO_SLOT });
    // Only Authorization and Expires can be set from JS. Cookie can't: it has to be set
    // via document.cookie instead, so it is dropped here (XEP-0363 § 4).
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
 * @param {import('./types').UploadTarget} slot
 * @param {(fraction: number) => void} [onProgress]
 * @returns {Promise<void>}
 * @throws An `Error` carrying the `status` and `responseText`, so a caller can quote the
 *      server's own complaint back to the user.
 */
export function putFile(file, slot, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const fail = (/** @type {string} */ msg) =>
            reject(Object.assign(new Error(msg), { status: xhr.status, responseText: xhr.responseText }));

        xhr.onreadystatechange = () => {
            if (xhr.readyState !== XMLHttpRequest.DONE) return;
            log.info(`http-upload: PUT status ${xhr.status}`);
            if (xhr.status === 200 || xhr.status === 201) resolve();
            else fail(`Upload failed (HTTP ${xhr.status})`);
        };
        if (onProgress) {
            xhr.upload.addEventListener('progress', (evt) => {
                if (evt.lengthComputable) onProgress(evt.loaded / evt.total);
            });
        }
        xhr.onerror = () => fail('The file upload failed');
        xhr.open('PUT', slot.put, true);
        xhr.setRequestHeader('Content-type', file.type);
        slot.headers?.forEach((h) => xhr.setRequestHeader(h.name, h.value));
        xhr.send(file);
    });
}

/**
 * Upload `file` via XEP-0363 and resolve to its public URL plus metadata.
 * @param {File} file
 * @param {object} [opts]
 * @param {string} [opts.domain] - Upload service host (defaults to our own domain).
 * @param {(fraction: number) => void} [opts.onProgress] - Upload progress (0..1).
 * @returns {Promise<import('./types').UploadedFile>}
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
