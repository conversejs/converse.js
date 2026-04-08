import { html } from 'lit';
import { getPopularReactions } from '../utils';

/**
 * @param {import('../reaction-picker').default} el
 */
export default (el) => {
    const anchor_name = `--reaction-anchor-${el.picker_id}`;
    const popular_reactions = getPopularReactions(el.allowed_emojis);

    return html`
        <div class="reaction-picker popular ${el.dropup ? 'dropup' : ''} ${el.shifted ? 'shifted' : ''}">
            ${popular_reactions.map(
                /** @param {string} sn */ (sn) =>
                    html` <button class="reaction-item" @click=${() => el.onEmojiSelected(sn)}>${sn}</button>`
            )}

            <div class="dropdown emoji-picker__dropdown">
                <button
                    class="reaction-item more dropdown-toggle"
                    type="button"
                    id="${el.picker_id}-dropdown"
                    style="anchor-name: ${anchor_name}"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    @click=${el.initEmojiPicker}
                >
                    <converse-icon class="fas fa-plus" size="1em"></converse-icon>
                </button>
                <ul
                    class="dropdown-menu"
                    aria-labelledby="${el.picker_id}-dropdown"
                    style="position-anchor: ${anchor_name}"
                >
                    <li>
                        ${el.model?.collection?.chatbox?.emoji_picker
                            ? html`
                                  <converse-emoji-picker
                                      .state=${el.model.collection.chatbox.emoji_picker}
                                      .model=${el.model.collection.chatbox}
                                      .allowed_emojis=${el.allowed_emojis}
                                      @emojiSelected=${(ev) => {
                                          ev.stopPropagation();
                                          el.onEmojiSelected(ev.detail.value);
                                      }}
                                      ?render_emojis=${true}
                                      current_category="${el.model.collection.chatbox.emoji_picker.get(
                                          'current_category'
                                      ) || ''}"
                                      current_skintone="${el.model.collection.chatbox.emoji_picker.get(
                                          'current_skintone'
                                      ) || ''}"
                                      query="${el.model.collection.chatbox.emoji_picker.get('query') || ''}"
                                  ></converse-emoji-picker>
                              `
                            : ''}
                    </li>
                </ul>
            </div>
        </div>
    `;
};
