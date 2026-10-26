/**
 * Uploads local files with headless's XEP-0363 helper, then shares their public
 * URL under the same routing policy as any other send.
 * @module @converse/daemon/files
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { getUploadService, uploadFile } from '@converse/headless';
import { draftNotice } from './notices.js';
import { sendMessage } from './messages.js';
import { ERRORS, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';

const CONTENT_TYPE = 'application/octet-stream';

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
         * @param {{ to: string, path: string }} params
         * @param {import('./types').Client} client
         * @returns {Promise<import('./types').SendResult>}
         */
        async 'files.upload'({ to, path: file_path }, client) {
            const jid = await resolveJID(_converse, to, 'to');
            return routeSend(client, jid, {
                action: 'upload',
                direct: async (routing) => {
                    const uploaded = await uploadLocalFile(file_path);
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
                    const uploaded = await uploadLocalFile(file_path);
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
 * @param {unknown} file_path
 * @returns {ReturnType<typeof uploadFile>}
 */
async function uploadLocalFile(file_path) {
    if (typeof file_path !== 'string' || !file_path.trim()) {
        throw new RPCError(ERRORS.INVALID_PARAMS, '"path" must name a readable local file.');
    }

    let metadata;
    try {
        metadata = await fs.stat(file_path);
        if (!metadata.isFile()) throw Object.assign(new Error('not a regular file'), { code: 'not-file' });
    } catch (e) {
        throw unreadable(file_path, e);
    }

    const service = await getUploadService();
    if (!service) {
        throw new RPCError(
            ERRORS.INTERNAL_ERROR,
            'The server offers no HTTP file upload service, so nothing was sent. ' +
                'Ask the server administrator to enable XEP-0363, or share the file another way.',
        );
    }
    if (metadata.size > service.max_file_size) {
        throw new RPCError(
            ERRORS.INVALID_PARAMS,
            `${JSON.stringify(path.basename(file_path))} is ${metadata.size} bytes, which exceeds the server's ` +
                `${service.max_file_size}-byte upload limit. Choose a smaller file.`,
        );
    }

    let contents;
    try {
        contents = await fs.readFile(file_path);
    } catch (e) {
        throw unreadable(file_path, e);
    }

    const file = new File([contents], path.basename(file_path), { type: CONTENT_TYPE });
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
 * @param {string} file_path
 * @param {Error & { code?: string }} error
 */
function unreadable(file_path, error) {
    return new RPCError(
        ERRORS.INVALID_PARAMS,
        `The file at ${JSON.stringify(file_path)} could not be read (${error.code ?? error.message}). ` +
            'Check that the path names a file the daemon may read, then try again.',
    );
}
