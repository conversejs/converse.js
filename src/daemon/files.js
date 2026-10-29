/**
 * Uploads files with headless's XEP-0363 helper, then shares their public URL
 * under the same routing policy as any other send.
 *
 * The client sends the file's contents. The daemon never opens a path a client
 * names: it can read its own config, credentials and audit log, which a
 * restricted client must not be able to have uploaded.
 * @module @converse/daemon/files
 */
import { getUploadService, uploadFile } from '@converse/headless';
import { draftNotice } from './notices.js';
import { sendMessage } from './messages.js';
import { ERRORS, MAX_UPLOAD_SIZE, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';

const CONTENT_TYPE = 'application/octet-stream';
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {Object} deps
 * @param {ReturnType<typeof import('./routing.js').createSendRouter>} deps.routeSend
 * @param {ReturnType<typeof import('./audit.js').createAudit>} deps.audit
 * @param {ReturnType<typeof import('./drafts.js').createDraftStore>} deps.drafts
 * @param {ReturnType<typeof import('./events.js').createEvents>} deps.events
 * @param {string} deps.owner
 */
export function fileMethods(_converse, { routeSend, audit, drafts, events, owner }) {
    return {
        /**
         * @param {{ to: string, name: string, content: string }} params - `content` is base64
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>}
         */
        async 'files.upload'(params, client) {
            const upload = checkUpload(params);
            const jid = await resolveJID(_converse, params.to, 'to');
            return routeSend(client, jid, {
                action: 'upload',
                direct: async (routing) => {
                    const uploaded = await uploadContents(upload);
                    const message = await sendMessage(_converse, jid, uploaded.url, {}, { oob_url: uploaded.url });
                    audit.record({
                        consumer: client.consumer,
                        to: jid,
                        outcome: 'sent',
                        id: message.id,
                        action: 'upload',
                        ...routing,
                    });
                    return { outcome: 'sent', message };
                },
                draft: async (routing) => {
                    const uploaded = await uploadContents(upload);
                    const added = drafts.add({
                        to: jid,
                        consumer: client.consumer,
                        action: 'send',
                        body: uploaded.url,
                    });
                    try {
                        await sendMessage(_converse, owner, draftNotice(added));
                    } catch (e) {
                        drafts.remove(added.id);
                        throw e;
                    }
                    audit.record({
                        consumer: client.consumer,
                        to: jid,
                        outcome: 'draft',
                        draft: added.id,
                        action: 'upload',
                        ...routing,
                    });
                    events.publishDraft('queued', added);
                    return { outcome: 'draft', draft_id: added.id };
                },
            });
        },
    };
}

/**
 * Checks an upload's params without decoding its contents, so that a malformed
 * request is turned down before policy or the upload service sees it.
 * @param {Record<string, unknown>} params
 * @returns {{ name: string, content: string, size: number }}
 */
function checkUpload(params) {
    if (Object.hasOwn(params, 'path')) {
        throw new RPCError(
            ERRORS.INVALID_PARAMS,
            `"files.upload" takes the file's "name" and base64 "content", not a "path": ` +
                `the daemon doesn't read files for its clients.`,
        );
    }
    const { content } = params;
    if (typeof content !== 'string' || content.length % 4 !== 0 || !BASE64.test(content)) {
        throw new RPCError(ERRORS.INVALID_PARAMS, `"content" must be the file's contents, base64-encoded.`);
    }
    // The name is only what the upload is called. Any directory part goes,
    // whichever separator it uses.
    const name = typeof params.name === 'string' ? params.name.split(/[\\/]/).pop().trim() : '';
    if (!name || name === '.' || name === '..') {
        throw new RPCError(ERRORS.INVALID_PARAMS, '"name" must be a file name, such as "report.pdf".');
    }
    const size = Buffer.byteLength(content, 'base64');
    if (size > MAX_UPLOAD_SIZE) throw tooLarge(name, size, MAX_UPLOAD_SIZE, "the daemon's");

    return { name, content, size };
}

/**
 * @param {{ name: string, content: string, size: number }} upload
 * @returns {ReturnType<typeof uploadFile>}
 */
async function uploadContents({ name, content, size }) {
    const service = await getUploadService();
    if (!service) {
        throw new RPCError(
            ERRORS.INTERNAL_ERROR,
            'The server offers no HTTP file upload service, so nothing was sent. ' +
                'Ask the server administrator to enable XEP-0363, or share the file another way.',
        );
    }
    if (size > service.max_file_size) throw tooLarge(name, size, service.max_file_size, "the server's");

    const file = new File([Buffer.from(content, 'base64')], name, { type: CONTENT_TYPE });
    try {
        return await uploadFile(file);
    } catch (e) {
        const detail = String(e.responseText || e.message);
        throw new RPCError(
            ERRORS.INTERNAL_ERROR,
            `The file could not be uploaded: ${JSON.stringify(detail)}. Nothing was sent. Try again.`,
        );
    }
}

/**
 * @param {string} name
 * @param {number} size
 * @param {number} limit
 * @param {string} whose
 */
function tooLarge(name, size, limit, whose) {
    return new RPCError(
        ERRORS.INVALID_PARAMS,
        `${JSON.stringify(name)} is ${size} bytes, which exceeds ${whose} ${limit}-byte upload limit. ` +
            'Choose a smaller file.',
    );
}
