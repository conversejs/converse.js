/**
 * @typedef {import('@converse/skeletor').Model} Model
 */
import { CustomElement } from '../components/element.js';
import { _converse, api, constants } from '@converse/headless';
import { onScrolledDown } from './utils.js';

const { CHATROOMS_TYPE, INACTIVE } = constants;


export default class BaseChatView extends CustomElement {

    static get properties () {
        return {
            jid: { type: String }
        }
    }

    constructor () {
        super();
        this.jid = /** @type {string} */ null;
        this.model = /** @type {Model} */ null;
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        _converse.state.chatboxviews.remove(this.jid, this);
    }

    updated () {
        if (this.model && this.jid !== this.model.get('jid')) {
            this.stopListening();
            _converse.state.chatboxviews.remove(this.model.get('jid'), this);
            delete this.model;
            this.requestUpdate();
            this.initialize();
        }
    }

    close (ev) {
        ev?.preventDefault?.();
        return this.model.close(ev);
    }

    maybeFocus () {
        api.settings.get('auto_focus') && this.focus();
    }

    focus () {
        const textarea_el = this.getElementsByClassName('chat-textarea')[0];
        if (textarea_el && document.activeElement !== textarea_el) {
            /** @type {HTMLTextAreaElement} */(textarea_el).focus();
        }
        return this;
    }

    getBottomPanel () {
        if (this.model.get('type') === CHATROOMS_TYPE) {
            return this.querySelector('converse-muc-bottom-panel');
        } else {
            return this.querySelector('converse-chat-bottom-panel');
        }
    }

    getMessageForm () {
        if (this.model.get('type') === CHATROOMS_TYPE) {
            return this.querySelector('converse-muc-message-form');
        } else {
            return this.querySelector('converse-message-form');
        }
    }

    /**
     * Scrolls the chat down.
     *
     * This method will always scroll the chat down, regardless of
     * whether the user scrolled up manually or not.
     * @param { Event } [ev] - An optional event that is the cause for needing to scroll down.
     */
    scrollDown (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        if (this.model.ui.get('scrolled')) {
            this.model.ui.set({ 'scrolled': false });
        }
        onScrolledDown(this.model);
    }

    onWindowStateChanged () {
        if (document.hidden) {
            this.model.setChatState(INACTIVE, { 'silent': true });
            this.model.sendChatState();
        } else {
            if (!this.model.isHidden()) {
                this.model.clearUnreadMsgCounter();
            }
        }
    }
}
