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
            this.listenTo(this.model, 'change:reactions', () => {
                this.emoji_map = getEmojiKeyedReactions(this.model.get('reactions') || {});
            });
            // Compute the initial map in case reactions were already set on the model
            // before this component's listener was attached (e.g. dangling reactions).
            this.emoji_map = getEmojiKeyedReactions(this.model.get('reactions') || {});
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
