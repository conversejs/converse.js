/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The MUC composer: the 1:1 chat one, plus occupant-nickname completion.
 */
import { MUCOccupant, api, converse, log } from '@converse/headless';
import MessageForm from 'plugins/chatview/message-form.js';
import { makeMentionSource } from './mention-source.js';

export default class MUCMessageForm extends MessageForm {
    getTypeaheadSources() {
        return [
            ...super.getTypeaheadSources(),
            makeMentionSource(
                () => this.getMUC(),
                () => this.shouldAutoComplete(),
            ),
        ];
    }

    /** The room being composed in, which for an occupant form is its parent room. */
    getMUC() {
        return this.model instanceof MUCOccupant ? this.model.collection.chatroom : this.model;
    }

    /**
     * Whether mentions apply right now: only once the room has been entered, and never as a
     * visitor in a moderated room, who cannot post anyway.
     * @returns {boolean}
     */
    shouldAutoComplete() {
        const muc = this.getMUC();
        if (!muc) {
            log.debug('Could not determine MUC for MUCMessageForm element');
            return false;
        }

        const entered = muc.session?.get('connection_status') === converse.ROOMSTATUS.ENTERED;
        return entered && !(muc.features.get('moderated') && muc.getOwnRole() === 'visitor');
    }
}

api.elements.define('converse-muc-message-form', MUCMessageForm);
