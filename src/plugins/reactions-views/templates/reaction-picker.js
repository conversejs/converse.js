import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import '../emoji-picker-dropdown.js';

/**
 * @param {import('../reaction-picker').default} el
 */
export default (el) => {
    const renderReactions = async () => {
        const popular_reactions = await el.popular_reactions_promise;
        return html`${popular_reactions.map(
            /** @param {string} sn */ (sn) =>
                html`<button class="reaction-item" @click=${() => el.onEmojiSelected(sn)}>${sn}</button>`
        )}`;
    };

    return html`
        <div class="reaction-picker popular ${el.dropup ? 'dropup' : ''} ${el.shifted ? 'shifted' : ''}">
            ${until(renderReactions(), html``)}
            <converse-emoji-picker-dropdown
                .message_model=${el.model}
                @emoji-picker-selected=${(ev) => el.onEmojiSelected(ev.detail.emoji)}
            ></converse-emoji-picker-dropdown>
        </div>
    `;
};