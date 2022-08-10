import ModelWithContact from './model-with-contact.js';
import dayjs from 'dayjs';
import log from '../../log.js';
import { _converse, api, converse } from '../../core.js';
import { getOpenPromise } from '@converse/openpromise';

const { Strophe, sizzle, u } = converse.env;

/**
 * Mixin which turns a `ModelWithContact` model into a non-MUC message. These can be either `chat` messages or `headline` messages.
 * @mixin
 * @namespace _converse.Message
 * @memberOf _converse
 * @example const msg = new _converse.Message({'message': 'hello world!'});
 */
const MessageMixin = {

    defaults () {
        return {
            'msgid': u.getUniqueId(),
            'time': new Date().toISOString(),
            'is_ephemeral': false
        };
    },

    async initialize () {
        if (!this.checkValidity()) {
            return;
        }
        this.initialized = getOpenPromise();
        if (this.get('file')) {
            this.on('change:put', () => this.uploadFile());
        }
        // If `type` changes from `error` to `chat`, we want to set the contact. See #2733
        this.on('change:type', () => this.setContact());
        this.on('change:is_ephemeral', () => this.setTimerForEphemeralMessage());

        await this.setContact();
        this.setTimerForEphemeralMessage();
        /**
         * Triggered once a {@link _converse.Message} has been created and initialized.
         * @event _converse#messageInitialized
         * @type { _converse.Message}
         * @example _converse.api.listen.on('messageInitialized', model => { ... });
         */
        await api.trigger('messageInitialized', this, { 'Synchronous': true });
        this.initialized.resolve();
    },


    setContact () {
        if (this.get('type') === 'chat') {
            ModelWithContact.prototype.initialize.apply(this, arguments);
            this.setRosterContact(Strophe.getBareJidFromJid(this.get('from')));
        }
    },

    /**
     * Sets an auto-destruct timer for this message, if it's is_ephemeral.
     * @private
     * @method _converse.Message#setTimerForEphemeralMessage
     */
    setTimerForEphemeralMessage () {
        if (this.ephemeral_timer) {
            clearTimeout(this.ephemeral_timer);
        }
        const is_ephemeral = this.isEphemeral();
        if (is_ephemeral) {
            const timeout = typeof is_ephemeral === "number" ? is_ephemeral : 10000;
            this.ephemeral_timer = window.setTimeout(() => this.safeDestroy(), timeout);
        }
    },

    checkValidity () {
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
    },

    /**
     * Determines whether this messsage may be retracted by the current user.
     * @private
     * @method _converse.Messages#mayBeRetracted
     * @returns { Boolean }
     */
    mayBeRetracted () {
        const is_own_message = this.get('sender') === 'me';
        const not_canceled = this.get('error_type') !== 'cancel';
        return is_own_message && not_canceled && ['all', 'own'].includes(api.settings.get('allow_message_retraction'));
    },

    safeDestroy () {
        try {
            this.destroy();
        } catch (e) {
            log.warn(`safeDestroy: ${e}`);
        }
    },

    /**
     * Returns a boolean indicating whether this message is ephemeral,
     * meaning it will get automatically removed after ten seconds.
     * @returns { boolean }
     */
    isEphemeral () {
        return this.get('is_ephemeral');
    },

    /**
     * Returns a boolean indicating whether this message is a XEP-0245 /me command.
     * @returns { boolean }
     */
    isMeCommand () {
        const text = this.getMessageText();
        if (!text) {
            return false;
        }
        return text.startsWith('/me ');
    },

    /**
     * Returns a boolean indicating whether this message is considered a followup
     * message from the previous one. Followup messages are shown grouped together
     * under one author heading.
     * A message is considered a followup of it's predecessor when it's a chat
     * message from the same author, within 10 minutes.
     * @returns { boolean }
     */
    isFollowup () {
        const messages = this.collection.models;
        const idx = messages.indexOf(this);
        const prev_model = idx ? messages[idx-1] : null;
        if (prev_model === null) {
            return false;
        }
        const date = dayjs(this.get('time'));
        return this.get('from') === prev_model.get('from') &&
            !this.isMeCommand() && !prev_model.isMeCommand() &&
            !!this.get('is_encrypted') === !!prev_model.get('is_encrypted') &&
            this.get('type') === prev_model.get('type') && this.get('type') !== 'info' &&
            date.isBefore(dayjs(prev_model.get('time')).add(10, 'minutes')) &&
            (this.get('type') === 'groupchat' ? this.get('occupant_id') === prev_model.get('occupant_id') : true);
    },

    getDisplayName () {
        if (this.contact) {
            return this.contact.getDisplayName();
        } else if (this.vcard) {
            return this.vcard.getDisplayName();
        } else {
            return this.get('from');
        }
    },

    getMessageText () {
        if (this.get('is_encrypted')) {
            const { __ } = _converse;
            return this.get('plaintext') || this.get('body') || __('Undecryptable OMEMO message');
        } else if (['groupchat', 'chat'].includes(this.get('type'))) {
            return this.get('body');
        } else {
            return this.get('message');
        }
    },

    /**
     * Send out an IQ stanza to request a file upload slot.
     * https://xmpp.org/extensions/xep-0363.html#request
     * @private
     * @method _converse.Message#sendSlotRequestStanza
     */
    sendSlotRequestStanza () {
        if (!this.file) {
            return Promise.reject(new Error('file is undefined'));
        }
        const iq = converse.env
            .$iq({
                'from': _converse.jid,
                'to': this.get('slot_request_url'),
                'type': 'get'
            })
            .c('request', {
                'xmlns': Strophe.NS.HTTPUPLOAD,
                'filename': this.file.name,
                'size': this.file.size,
                'content-type': this.file.type
            });
        return api.sendIQ(iq);
    },

    getUploadRequestMetadata (stanza) {
        const headers = sizzle(`slot[xmlns="${Strophe.NS.HTTPUPLOAD}"] put header`, stanza);
        // https://xmpp.org/extensions/xep-0363.html#request
        // TODO: Can't set the Cookie header in JavaScipt, instead cookies need
        // to be manually set via document.cookie, so we're leaving it out here.
        return {
            'headers': headers
                .map(h => ({ 'name': h.getAttribute('name'), 'value': h.textContent }))
                .filter(h => ['Authorization', 'Expires'].includes(h.name))
        }
    },

    async getRequestSlotURL () {
        const { __ } = _converse;
        let stanza;
        try {
            stanza = await this.sendSlotRequestStanza();
        } catch (e) {
            log.error(e);
            return this.save({
                'type': 'error',
                'message': __('Sorry, could not determine upload URL.'),
                'is_ephemeral': true
            });
        }
        const slot = sizzle(`slot[xmlns="${Strophe.NS.HTTPUPLOAD}"]`, stanza).pop();
        if (slot) {
            this.upload_metadata = this.getUploadRequestMetadata(stanza);
            this.save({
                'get': slot.querySelector('get').getAttribute('url'),
                'put': slot.querySelector('put').getAttribute('url')
            });
        } else {
            return this.save({
                'type': 'error',
                'message': __('Sorry, could not determine file upload URL.'),
                'is_ephemeral': true
            });
        }
    },

    uploadFile () {
        const xhr = new XMLHttpRequest();

        xhr.onreadystatechange = async () => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                log.info('Status: ' + xhr.status);
                if (xhr.status === 200 || xhr.status === 201) {
                    let attrs = {
                        'upload': _converse.SUCCESS,
                        'oob_url': this.get('get'),
                        'message': this.get('get'),
                        'body': this.get('get'),
                    };
                    /**
                     * *Hook* which allows plugins to change the attributes
                     * saved on the message once a file has been uploaded.
                     * @event _converse#afterFileUploaded
                     */
                    attrs = await api.hook('afterFileUploaded', this, attrs);
                    this.save(attrs);
                } else {
                    xhr.onerror();
                }
            }
        };

        xhr.upload.addEventListener(
            'progress',
            evt => {
                if (evt.lengthComputable) {
                    this.set('progress', evt.loaded / evt.total);
                }
            },
            false
        );

        xhr.onerror = () => {
            const { __ } = _converse;
            let message;
            if (xhr.responseText) {
                message = __(
                    'Sorry, could not succesfully upload your file. Your server’s response: "%1$s"',
                    xhr.responseText
                );
            } else {
                message = __('Sorry, could not succesfully upload your file.');
            }
            this.save({
                'type': 'error',
                'upload': _converse.FAILURE,
                'message': message,
                'is_ephemeral': true
            });
        };
        xhr.open('PUT', this.get('put'), true);
        xhr.setRequestHeader('Content-type', this.file.type);
        this.upload_metadata.headers?.forEach(h => xhr.setRequestHeader(h.name, h.value));
        xhr.send(this.file);
    }
};

export default MessageMixin;
