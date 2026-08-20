import { Strophe } from 'strophe.js';
import { Model } from '@converse/skeletor';
import log from '@converse/log';
import _converse from '../shared/_converse.js';
import api from '../shared/api/index.js';
import { SUCCESS, FAILURE } from '../shared/constants.js';
import ColorAwareModel from '../shared/color.js';
import ModelWithContact from '../shared/model-with-contact.js';
import ModelWithVCard from '../shared/model-with-vcard.js';
import { getUniqueId } from '../utils/index.js';
import converse from './api/public.js';
import { NO_SLOT, putFile, requestSlot } from './http-upload.js';

const { dayjs } = converse.env;

/**
 * @extends {Model<import('./types').BaseMessageAttributes>}
 */
class BaseMessage extends ModelWithVCard(ModelWithContact(ColorAwareModel(Model))) {
    defaults() {
        return {
            msgid: getUniqueId(),
            time: new Date().toISOString(),
            is_ephemeral: false,
        };
    }

    /**
     * @param {import('./types').MessageAttributes} attrs
     * @param {import('@converse/skeletor').ModelOptions} options
     */
    constructor(attrs, options) {
        super(attrs, options);
        this.file = null;
    }

    initialize() {
        this.lazy_load_vcard = true;
        super.initialize();

        this.chatbox = this.collection?.chatbox;
        if (!this.checkValidity()) return;

        if (this.get('file')) {
            this.on('change:put', () => this.uploadFile());
        }
        this.on('change:is_ephemeral', () => this.setTimerForEphemeralMessage());
        this.setTimerForEphemeralMessage();
    }

    checkValidity() {
        if (Object.keys(this.attributes).length === 3) {
            // XXX: This is an empty message with only the 3 default values.
            // This seems to happen when saving a newly created message
            // fails for some reason.
            // TODO: This is likely fixable by setting `wait` when
            // creating messages. See the wait-for-messages branch.
            this.validationError = 'Empty message';
            this.safeDestroy();
            return false;
        }
        return true;
    }

    safeDestroy() {
        try {
            this.destroy();
        } catch (e) {
            log.warn(`safeDestroy: ${e}`);
        }
    }

    /**
     * Sets an auto-destruct timer for this message, if it's is_ephemeral.
     */
    setTimerForEphemeralMessage() {
        if (this.ephemeral_timer) {
            clearTimeout(this.ephemeral_timer);
            this.ephemeral_timer = null;
        }
        if (!this.isEphemeral()) return;

        // Some ephemeral messages (e.g. an OMEMO "couldn't be decrypted" notice)
        // shouldn't start counting down until we're confident the user has seen
        // them. For those the countdown is started externally (by the view, once
        // the message scrolls into view) via `startEphemeralTimer`.
        if (this.get('defer_ephemeral_timer')) return;

        this.startEphemeralTimer();
    }

    /**
     * Start the auto-destruct countdown for this ephemeral message.
     * Safe to call more than once; the running timer is reset each time.
     */
    startEphemeralTimer() {
        const is_ephemeral = this.isEphemeral();
        if (!is_ephemeral) return;
        if (this.ephemeral_timer) clearTimeout(this.ephemeral_timer);
        const timeout = typeof is_ephemeral === 'number' ? is_ephemeral : 10000;
        this.ephemeral_timer = setTimeout(() => this.safeDestroy(), timeout);
    }

    /**
     * Returns a boolean indicating whether this message is ephemeral,
     * meaning it will get automatically removed after ten seconds.
     * @returns {boolean | number}
     */
    isEphemeral() {
        return this.get('is_ephemeral');
    }

    /**
     * Returns a boolean indicating whether this message is a XEP-0245 /me command.
     * @returns {boolean}
     */
    isMeCommand() {
        const text = this.getMessageText();
        if (!text) {
            return false;
        }
        return text.startsWith('/me ');
    }

    /**
     * @returns {boolean}
     */
    isRetracted() {
        return !!(this.get('retracted') || this.get('moderated') === 'retracted');
    }

    /**
     * Returns a boolean indicating whether this message is considered a followup
     * message from the previous one. Followup messages are shown grouped together
     * under one author heading.
     * A message is considered a followup of it's predecessor when it's a chat
     * message from the same author, within 10 minutes.
     * @returns {boolean}
     */
    isFollowup() {
        const messages = this.collection?.models;
        if (!messages) {
            // Happens during tests
            return false;
        }
        const idx = messages.indexOf(this);
        const prev_model = idx ? messages[idx - 1] : null;
        if (prev_model === null) {
            return false;
        }
        const date = dayjs(this.get('time'));
        return (
            this.get('from') === prev_model.get('from') &&
            !this.isRetracted() &&
            !prev_model.isRetracted() &&
            !this.isMeCommand() &&
            !prev_model.isMeCommand() &&
            !!this.get('is_encrypted') === !!prev_model.get('is_encrypted') &&
            this.get('type') === prev_model.get('type') &&
            this.get('type') !== 'info' &&
            date.isBefore(dayjs(prev_model.get('time')).add(10, 'minutes')) &&
            (this.get('type') === 'groupchat' ? this.get('occupant_id') === prev_model.get('occupant_id') : true)
        );
    }

    /**
     * Determines whether this message may be retracted by the current user.
     * @returns { Boolean }
     */
    mayBeRetracted() {
        const is_own_message = this.get('sender') === 'me';
        const not_canceled = this.get('error_type') !== 'cancel';
        return is_own_message && not_canceled && ['all', 'own'].includes(api.settings.get('allow_message_retraction'));
    }

    getMessageText() {
        let text;
        if (this.get('is_encrypted')) {
            const { __ } = _converse;
            text = this.get('plaintext') || this.get('body') || __('Undecryptable OMEMO message');
        } else if (['groupchat', 'chat', 'normal'].includes(this.get('type'))) {
            text = this.get('body');
        } else {
            text = this.get('message');
        }
        return this.stripReplyFallback(text);
    }

    /**
     * Strip the XEP-0461 compatibility fallback — the `>`-quoted copy of the
     * replied-to message — from `text`. Converse renders the reply context from
     * the structured `<reply>`, so per XEP-0461 it must not also show the quoted
     * fallback. Offsets are XEP-0426 Unicode code points, so we slice on the
     * code-point array rather than UTF-16 units.
     * @param {string} text
     * @returns {string}
     */
    stripReplyFallback(text) {
        const fallback = this.get('fallback')?.[Strophe.NS.REPLY];
        if (!text || !fallback || !this.get('reply_to_id')) return text;
        const chars = [...text];
        return chars.slice(0, fallback.start).join('') + chars.slice(fallback.end).join('');
    }

    /**
     * Request an upload slot (XEP-0363 § 4) and record it on the message, which starts
     * the upload: saving `put` fires the `change:put` handler set up in `initialize`.
     *
     * The protocol itself lives in `http-upload.js`; what belongs here is reporting a
     * failure as an ephemeral error message in the conversation.
     */
    async getRequestSlotURL() {
        const { __ } = _converse;
        if (!this.file) {
            log.error('getRequestSlotURL called with no file');
            return;
        }
        let slot;
        try {
            slot = await requestSlot(this.file, this.get('slot_request_url'));
        } catch (e) {
            log.error(e);
            return this.save({
                is_ephemeral: true,
                message:
                    e.code === NO_SLOT
                        ? __('Sorry, could not determine file upload URL.')
                        : __('Sorry, could not determine upload URL.'),
                type: 'error',
            });
        }
        this.upload_metadata = { headers: slot.headers };
        this.save({ get: slot.get, put: slot.put });
    }

    /**
     * PUT the file to the slot recorded by {@link getRequestSlotURL}, tracking progress
     * on the message so the UI can show a progress bar.
     *
     * Called off a `change:put` listener, so nothing awaits it: it has to settle its own
     * failures rather than reject.
     */
    async uploadFile() {
        const { __ } = _converse;
        try {
            await putFile(this.file, { put: this.get('put'), headers: this.upload_metadata?.headers }, (fraction) =>
                this.set('progress', fraction),
            );
        } catch (e) {
            log.error(e);
            return this.save({
                is_ephemeral: true,
                message: e.responseText
                    ? __(
                          'Sorry, could not successfully upload your file. Your server’s response: "%1$s"',
                          e.responseText,
                      )
                    : __('Sorry, could not successfully upload your file.'),
                type: 'error',
                upload: FAILURE,
            });
        }

        let attrs = {
            body: this.get('get'),
            message: this.get('get'),
            oob_url: this.get('get'),
            upload: SUCCESS,
        };
        /**
         * *Hook* which allows plugins to change the attributes
         * saved on the message once a file has been uploaded.
         * @event _converse#afterFileUploaded
         */
        attrs = await api.hook('afterFileUploaded', this, attrs);
        this.save(attrs);
    }
}

export default BaseMessage;
