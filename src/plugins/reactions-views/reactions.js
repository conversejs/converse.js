import { api } from '@converse/headless';
import { html, nothing } from 'lit';
import { until } from 'lit/directives/until.js';
import { CustomElement } from 'shared/components/element.js';
import { sendReaction, getOwnReactionJID, getReactorNames, getEmojiKeyedReactions } from './utils.js';

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

    /**
     * @param {string} emoji
     */
    onReactionClick(emoji) {
        sendReaction(this.model, emoji);
    }

    render() {
        const chatbox = this.model?.collection?.chatbox;
        const my_jid = chatbox ? getOwnReactionJID(chatbox) : null;

        const reactions = this.model?.get('reactions') || {};
        const emoji_map = getEmojiKeyedReactions(reactions);
        const emojis = Object.keys(emoji_map);

        if (emojis.length === 0) {
            return nothing;
        }

        return html`
            <div class="chat-msg__reactions">
                ${emojis.map((emoji) => {
                    const reactors = emoji_map[emoji] || [];
                    const count = reactors.length;
                    const tooltip_promise = chatbox
                        ? getReactorNames(reactors, chatbox)
                        : Promise.resolve(reactors.join('\n'));
                    const i_reacted = reactors.includes(my_jid);
                    return html`
                        <button
                            class="chat-msg__reaction ${i_reacted ? 'reacted' : ''}"
                            data-tooltip="${until(tooltip_promise, reactors.join('\n'))}"
                            title="${until(tooltip_promise, reactors.join('\n'))}"
                            @click=${() => this.onReactionClick(emoji)}
                        >
                            ${emoji} <span class="count">${count}</span>
                        </button>
                    `;
                })}
            </div>
        `;
    }
}

api.elements.define('converse-reactions', Reactions);
