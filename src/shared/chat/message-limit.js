import tplMessageLimit from './templates/message-limit.js';
import { CustomElement } from 'shared/components/element.js';
import { api } from '@converse/headless/core';

export default class MessageLimitIndicator extends CustomElement {

    static get properties () {
        return {
            model: { type: Object }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.listenTo(this.model, 'change:draft', () => this.requestUpdate());
    }

    render () {
        const limit = api.settings.get('message_limit');
        if (!limit) return '';
        const chars = this.model.get('draft') || '';
        return tplMessageLimit(limit - chars.length);
    }
}

api.elements.define('converse-message-limit-indicator', MessageLimitIndicator);
