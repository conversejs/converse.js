import { converse, api, _converse } from '@converse/headless';
import { registerRestrictedReactionsHandler } from './utils.js';

import { html } from 'lit';
import { __ } from 'i18n';

const { Strophe } = converse.env;

/**
 * Tracks which message models currently have their reaction picker open,
 * storing the anchor button's DOMRect so the picker can position itself
 * near the button that was clicked.
 * @type {WeakMap<object, DOMRect|null>}
 */
const picker_state = new WeakMap();

converse.plugins.add('converse-reaction-views', {
    dependencies: ['converse-reactions', 'converse-disco', 'converse-chatview', 'converse-muc-views'],

    /**
     * Initializes the reactions UI plugin
     * Sets up event listeners for:
     * - Adding reaction buttons to messages
     * - Handling reaction picker interactions
     * - Disco feature advertisement and restrictions
     */
    initialize() {
        this.allowed_emojis = new Map();

        api.settings.extend({
            'popular_reactions': [':thumbsup:', ':heart:', ':joy:', ':open_mouth:'],
        });

        // Advertise reactions support
        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add(Strophe.NS.REACTIONS);
        });

        api.listen.on('connected', () => registerRestrictedReactionsHandler(this.allowed_emojis));
        api.listen.on('reconnected', () => registerRestrictedReactionsHandler(this.allowed_emojis));

        api.listen.on('getMessageActionButtons', (el, buttons) => {
            buttons.unshift({
                'i18n_text': __('Add Reaction'),
                'handler': (ev) => {
                    ev?.preventDefault?.();
                    ev?.stopPropagation?.();
                    const btn = /** @type {HTMLElement} */ (ev.currentTarget ?? ev.target);
                    const anchor_rect = btn?.getBoundingClientRect() ?? null;
                    picker_state.set(el.model, !picker_state.get(el.model) ? anchor_rect : null);
                    const dropdown = el.renderRoot?.querySelector('converse-dropdown');
                    dropdown?.dropdown?.hide?.();
                    el.requestUpdate();
                },
                'button_class': 'chat-msg__action-reaction',
                'icon_class': 'fas fa-smile',
                'name': 'reaction',
            });

            return buttons;
        });

        api.listen.on('getMessageActionContent', (el, content) => {
            const anchor_rect = picker_state.get(el.model);
            if (!anchor_rect) return content;
            return html`${content}<converse-reaction-picker
                    .model=${el.model}
                    .anchor_rect=${anchor_rect}
                    @closePicker=${() => {
                        picker_state.delete(el.model);
                        el.requestUpdate();
                    }}
                ></converse-reaction-picker>`;
        });
    },
});
