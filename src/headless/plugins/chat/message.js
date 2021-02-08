import ModelWithContact from './model-with-contact.js';
import log from '../../log.js';
import { _converse, api, converse } from '../../core.js';

const u = converse.env.utils;
const { Strophe } = converse.env;

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
        this.initialized = u.getResolveablePromise();
        if (this.get('type') === 'chat') {
            ModelWithContact.prototype.initialize.apply(this, arguments);
            this.setRosterContact(Strophe.getBareJidFromJid(this.get('from')));
        }
        if (this.get('file')) {
            this.on('change:put', this.uploadFile, this);
        }
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

    /**
     * Sets an auto-destruct timer for this message, if it's is_ephemeral.
     * @private
     * @method _converse.Message#setTimerForEphemeralMessage
     * @returns { Boolean } - Indicates whether the message is
     *   ephemeral or not, and therefore whether the timer was set or not.
     */
    setTimerForEphemeralMessage () {
        const setTimer = () => {
            this.ephemeral_timer = window.setTimeout(this.safeDestroy.bind(this), 10000);
        };
        if (this.isEphemeral()) {
            setTimer();
            return true;
        } else {
            this.on('change:is_ephemeral', () =>
                this.isEphemeral() ? setTimer() : clearTimeout(this.ephemeral_timer)
            );
            return false;
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
            log.error(e);
        }
    },

    isEphemeral () {
        return this.get('is_ephemeral');
    },

    getDisplayName () {
        if (this.get('type') === 'groupchat') {
            return this.get('nick');
        } else if (this.contact) {
            return this.contact.getDisplayName();
        } else if (this.vcard) {
            return this.vcard.getDisplayName();
        } else {
            return this.get('from');
        }
    },

    getMessageText () {
        const { __ } = _converse;
        if (this.get('is_encrypted')) {
            return this.get('plaintext') || this.get('body') || __('Undecryptable OMEMO message');
        }
        return this.get('message');
    },

    isMeCommand () {
        const text = this.getMessageText();
        if (!text) {
            return false;
        }
        return text.startsWith('/me ');
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
        const slot = stanza.querySelector('slot');
        if (slot) {
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
        xhr.onreadystatechange = () => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                log.info('Status: ' + xhr.status);
                if (xhr.status === 200 || xhr.status === 201) {
                    this.save({
                        'upload': _converse.SUCCESS,
                        'oob_url': this.get('get'),
                        'message': this.get('get')
                    });
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
        xhr.send(this.file);
    }
};

export default MessageMixin;
