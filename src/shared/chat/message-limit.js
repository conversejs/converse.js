import tplMessageLimit from './templates/message-limit.js';
import { CustomElement } from 'shared/components/element.js';
import { api } from '@converse/headless';

export default class MessageLimitIndicator extends CustomElement {

    static get properties () {
        return {
            model: { type: Object },
            _draft_length: { state: true }
        }
    }

    constructor () {
        super();
        this.model = null;
        this._draft_length = 0;
    }

    connectedCallback () {
        super.connectedCallback();
        this._draft_length = this.model.get('draft')?.length ?? 0;

        this.listenTo(this.model, 'change:draft', () => {
            this._draft_length = this.model.get('draft')?.length ?? 0;
        });
        this.listenTo(this.model, 'event:keyup', ({ ev, text }) => {
            // A contenteditable composer has no `.value`, so it reports its text directly.
            if (typeof text === 'string') {
                this._draft_length = text.length;
                return;
            }
            const textarea = /** @type {HTMLTextAreaElement} */ (ev.target);
            this._draft_length = textarea.value.length;
        });
    }

    render () {
        const limit = api.settings.get('message_limit');
        if (!limit) return '';
        return tplMessageLimit(limit - this._draft_length);
    }
}

api.elements.define('converse-message-limit-indicator', MessageLimitIndicator);
