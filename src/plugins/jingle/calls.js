import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { _converse, api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';

import './styles/calls.scss';

/**
 * Always-present overlay that renders one `<converse-call>` per live call,
 * independent of which chat is open. Mirrors `<converse-toasts>`.
 */
export class Calls extends CustomElement {
    async initialize() {
        await api.waitUntil('callsInitialized');
        this.model = _converse.state.calls;
        this.listenTo(this.model, 'add', () => this.requestUpdate());
        this.listenTo(this.model, 'remove', () => this.requestUpdate());
        this.requestUpdate();
    }

    render() {
        const calls = this.model?.models ?? [];
        return html`${repeat(
            calls,
            (call) => call.get('id'),
            (call) => html`<converse-call .model=${call}></converse-call>`
        )}`;
    }
}

api.elements.define('converse-calls', Calls);
