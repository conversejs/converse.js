import { api } from '@converse/headless';
import { html, nothing } from 'lit';
import { CustomElement } from 'shared/components/element.js';

export default class Reactions extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
        };
    }

    constructor() {
        super();
        this.model = null;
    }

    /**
     * @param {import('lit').PropertyValues} changed
     */
    updated(changed) {
        if (!changed.has('model')) {
            return;
        }

        this.stopListening();
        if (this.model) {
            this.listenTo(this.model, 'change:reactions', () => this.requestUpdate());
        }
    }

    render() {
        const reactions = this.model?.get('reactions') || {};
        const keys = Object.keys(reactions);
        if (keys.length === 0) {
            return nothing;
        }

        /** @type {Record<string, string[]>} */
        const emoji_map = {};
        for (const jid of keys) {
            const user_emojis = reactions[jid];
            if (!Array.isArray(user_emojis)) {
                continue;
            }
            for (const emoji of user_emojis) {
                if (!emoji_map[emoji]) {
                    emoji_map[emoji] = [];
                }
                emoji_map[emoji].push(jid);
            }
        }

        const emojis = Object.keys(emoji_map);
        if (emojis.length === 0) {
            return nothing;
        }

        return html`
            <div class="chat-msg__reactions">
                ${emojis.map((emoji) => {
                    const reactors = emoji_map[emoji] || [];
                    const count = reactors.length;
                    const tooltip = reactors.join('\n');
                    return html`
                        <button class="chat-msg__reaction" data-tooltip="${tooltip}" title="${tooltip}">
                            ${emoji} <span class="count">${count}</span>
                        </button>
                    `;
                })}
            </div>
        `;
    }
}

api.elements.define('converse-reactions', Reactions);
