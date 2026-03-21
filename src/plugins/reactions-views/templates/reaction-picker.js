import { html } from 'lit';
import { api, u } from '@converse/headless';

/**
 * @param {import('../reaction-picker').default} el
 */
export default (el) => {
    const popular_emojis = api.settings.get('popular_reactions');
    const anchor_name = `--reaction-anchor-${el.picker_id}`;
    const filtered_emojis = el.allowed_emojis
        ? popular_emojis.filter(
              /** @param {string} sn */ (sn) =>
                  el.allowed_emojis.includes(u.shortnamesToEmojis(sn, { unicode_only: true }).join('')),
          )
        : popular_emojis;

    return html`
        <div class="reaction-picker popular ${el.dropup ? 'dropup' : ''} ${el.shifted ? 'shifted' : ''}">
            ${filtered_emojis.map(
                /** @param {string} sn */ (sn) => html`
                    <button class="reaction-item" @click=${() => el.onEmojiSelected(sn)}>
                        ${u.shortnamesToEmojis(sn)}
                    </button>
                `,
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
                        ${el.emoji_picker_state
                            ? html`
                                  <converse-emoji-picker
                                      .state=${el.emoji_picker_state}
                                      .model=${el.model.collection.chatbox}
                                      .allowed_emojis=${el.allowed_emojis}
                                      @emojiSelected=${(ev) => {
                                          ev.stopPropagation();
                                          el.onEmojiSelected(ev.detail.value);
                                      }}
                                      ?render_emojis=${true}
                                      current_category="${el.emoji_picker_state.get('current_category') || ''}"
                                      current_skintone="${el.emoji_picker_state.get('current_skintone') || ''}"
                                      query="${el.emoji_picker_state.get('query') || ''}"
                                  ></converse-emoji-picker>
                              `
                            : ''}
                    </li>
                </ul>
            </div>
        </div>
    `;
};
