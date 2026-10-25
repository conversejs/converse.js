/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { html } from 'lit';
import { _converse, api, constants, converse, getUploadService } from '@converse/headless';
import { __ } from 'i18n';
import { isRecordingSupported } from './session.js';

const { Strophe } = converse.env;
const { CHATROOMS_TYPE, FAILURE, PRIVATE_CHAT_TYPE } = constants;

// Recorder states
export const IDLE = 'idle';
export const REQUESTING = 'requesting-permission';
export const RECORDING = 'recording';
export const PAUSED = 'paused';
export const UPLOADING = 'uploading';
export const ERROR = 'error';

const EXTENSIONS = {
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'weba',
};

// The voice message's place in the attachment menu: after file, image and location.
const VOICE_MESSAGE_ORDER = 400;

/**
 * The share of the upload service's file size limit that a recording may
 * fill. The rest is kept in hand for the container, and for the encoder
 * overshooting the bitrate it was asked for, which for Opus is an average.
 */
const SIZE_MARGIN = 7 / 8;

/**
 * @typedef {import('@converse/headless').ChatBox|import('@converse/headless').MUC} ChatModel
 * @typedef {import('./session.js').Recording} Recording
 */

/**
 * @param {number} ms
 * @returns {string} The duration as m:ss
 */
export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * @param {ChatModel} model
 * @returns {boolean}
 */
function isVoiceChat(model) {
    const type = model.get('type');
    return type === PRIVATE_CHAT_TYPE || type === CHATROOMS_TYPE;
}

/**
 * Open the recorder in the given chat, closing any other open recorder, so
 * that only one recording is active at a time.
 * @param {ChatModel} model
 */
export function openRecorder(model) {
    _converse.state.chatboxes.forEach((m) => m !== model && m.ui?.set('voice_recorder', false));
    if (model.ui.get('voice_recorder')) {
        model.ui.trigger('voice-recorder:reopen');
    } else {
        model.ui.set('voice_recorder', true);
    }
}

/**
 * How long a recording at `bitrate` can be before it outgrows the upload
 * service's file size limit, in seconds, so that whatever gets recorded can
 * be sent. `Infinity` when the service doesn't state a limit, or there is
 * no service.
 * @param {number} bitrate - In bits per second
 * @returns {Promise<number>}
 */
export async function getUploadDurationLimit(bitrate) {
    const max_file_size = (await getUploadService())?.max_file_size ?? Infinity;
    if (!Number.isFinite(max_file_size) || !(bitrate > 0)) return Infinity;
    return Math.floor((max_file_size * 8 * SIZE_MARGIN) / bitrate);
}

/**
 * `getAttachmentMenuItems` handler: the "Record a voice message" item, listed
 * once the server is known to offer HTTP File Upload.
 * @param {import('shared/chat/attachment-menu').default} menu
 * @param {import('shared/chat/types').AttachmentMenuItem[]} items
 */
export async function getVoiceMessageItem(menu, items) {
    const { model } = menu;
    if (
        !api.settings.get('visible_toolbar_buttons')?.voice_message ||
        !isRecordingSupported() ||
        !isVoiceChat(model) ||
        (model.get('type') === CHATROOMS_TYPE && !(/** @type {any} */ (model).canPostMessages()))
    ) {
        return items;
    }
    const domain = _converse.session.get('domain');
    if (await api.disco.supports(Strophe.NS.HTTPUPLOAD, domain)) {
        items.push({
            name: 'voice-message',
            order: VOICE_MESSAGE_ORDER,
            icon: 'fa-microphone',
            label: __('Record a voice message'),
            handler: () => openRecorder(model),
        });
    }
    return items;
}

/**
 * `getComposerPanels` handler: the recorder, which renders nothing until opened.
 * @param {import('shared/chat/composer-panels').default} container
 * @param {import('shared/chat/types').ComposerPanelEntry[]} panels
 */
export function getRecorderPanel(container, panels) {
    if (isVoiceChat(container.model)) {
        panels.push({
            name: 'voice-recorder',
            order: 200,
            template: html`<converse-audio-recorder .model=${container.model}></converse-audio-recorder>`,
        });
    }
    return panels;
}

/**
 * @param {Recording} recording
 * @returns {File}
 */
function createAudioFile({ blob, mime_type }) {
    const type = mime_type.split(';')[0];
    const extension = EXTENSIONS[type] ?? type.split('/')[1] ?? 'audio';
    return new File([blob], `voice-message-${Date.now()}.${extension}`, { type });
}

/**
 * Upload a recording and send it out as a file message.
 * Resolves once the upload has succeeded.
 * @param {ChatModel} model
 * @param {Recording} recording
 * @throws {Error} if the file could not be uploaded, with a message for the user.
 */
export async function sendVoiceMessage(model, recording) {
    const [message] = await model.sendFiles([createAudioFile(recording)]);
    if (!message) {
        // The server has no upload service
        throw new Error(__('Sorry, looks like file upload is not supported by your server.'));
    }
    const upload =
        message.get('upload') ??
        (await new Promise((resolve) => {
            message.once('change:upload', () => resolve(message.get('upload')));
            message.once('destroy', () => resolve(FAILURE));
        }));
    if (upload === FAILURE) {
        throw new Error(message.get('message') || __('Sorry, could not successfully upload your file.'));
    }
}
