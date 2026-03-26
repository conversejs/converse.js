import { api, u } from '@converse/headless';
import { html, nothing } from 'lit';
import { until } from 'lit/directives/until.js';
import { CustomElement } from 'shared/components/element.js';
import { sendReaction, getReactorNames, getEmojiKeyedReactions } from './utils.js';

export default class Reactions extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
            emoji_map: { state: true },
        };
    }

    constructor() {
        super();
        this.model = null;
        this.emoji_map = {};
        /** @type {Map<string, Promise<string>>} */
        this._tooltip_cache = new Map();
    }

    /**
     * Recomputes the emoji map and clears the tooltip cache.
     * Called when the model is first assigned and on every change:reactions event.
     */
    #updateEmojiMap() {
        this.emoji_map = getEmojiKeyedReactions(this.model.get('reactions') || {});
        this._tooltip_cache = new Map();
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
            this.listenTo(this.model, 'change:reactions', () => this.#updateEmojiMap());
            // Compute the initial map in case reactions were already set on the model
            // before this component's listener was attached (e.g. dangling reactions).
            this.#updateEmojiMap();
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
        const my_jid = chatbox ? u.reactions.getOwnReactionJID(chatbox) : null;

        const emoji_map = this.emoji_map;
        const emojis = Object.keys(emoji_map);

        if (emojis.length === 0) {
            return nothing;
        }

        return html`
            <div class="chat-msg__reactions">
                ${emojis.map((emoji) => {
                    const reactors = emoji_map[emoji] || [];
                    const count = reactors.length;
                    const cache_key = reactors.join(',');
                    if (!this._tooltip_cache.has(cache_key)) {
                        this._tooltip_cache.set(
                            cache_key,
                            chatbox ? getReactorNames(reactors, chatbox) : Promise.resolve(reactors.join('\n')),
                        );
                    }
                    const tooltip_promise = this._tooltip_cache.get(cache_key);
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
