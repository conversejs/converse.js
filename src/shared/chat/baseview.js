import { _converse, api, constants } from '@converse/headless';
import { CustomElement } from '../components/element.js';
import { MOBILE_CUTOFF } from 'shared/constants.js';
import { onScrolledDown } from './utils.js';

const { CHATROOMS_TYPE, INACTIVE } = constants;

export default class BaseChatView extends CustomElement {
    static get properties() {
        return {
            jid: { type: String },
            model: { state: true },
        };
    }

    constructor() {
        super();
        this.jid = /** @type {string} */ null;
        this.model = /** @type {import('@converse/headless').Model} */ null;
        this.viewportMediaQuery = window.matchMedia(`(max-width: ${MOBILE_CUTOFF}px)`);
        this.renderOnViewportChange = () => this.requestUpdate();
    }

    connectedCallback() {
        super.connectedCallback();
        this.viewportMediaQuery.addEventListener('change', this.renderOnViewportChange);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        _converse.state.chatboxviews.remove(this.jid, this);
        this.viewportMediaQuery.removeEventListener('change', this.renderOnViewportChange);
    }

    /**
     * Called when the element's properties change.
     * @param {import('lit').PropertyValues} changed
     */
    updated(changed) {
        super.updated(changed);
        if (changed.has('jid') && this.model && this.jid !== this.model.get('jid')) {
            this.stopListening();
            _converse.state.chatboxviews.remove(this.model.get('jid'), this);
            this.initialize();
        }
    }

    /**
     * @param {MouseEvent} ev
     */
    close(ev) {
        ev?.preventDefault?.();
        return this.model?.close(ev);
    }

    maybeFocus() {
        api.settings.get('auto_focus') && this.focus();
    }

    focus() {
        const textarea_el = this.getElementsByClassName('chat-textarea')[0];
        if (textarea_el && document.activeElement !== textarea_el) {
            /** @type {HTMLTextAreaElement} */ (textarea_el).focus();
        }
        return this;
    }

    getBottomPanel() {
        if (this.model.get('type') === CHATROOMS_TYPE) {
            return this.querySelector('converse-muc-bottom-panel');
        } else {
            return this.querySelector('converse-chat-bottom-panel');
        }
    }

    getMessageForm() {
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
    scrollDown(ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        if (this.model.ui.get('scrolled')) {
            this.model.ui.set({ 'scrolled': false });
        }
        onScrolledDown(this.model);
    }

    onWindowStateChanged() {
        if (document.hidden) {
            this.model.setChatState(INACTIVE, { 'silent': true });
        } else {
            if (!this.model.isHidden()) {
                this.model.clearUnreadMsgCounter();
            }
        }
    }
}
