import { html } from 'lit';
import { _converse, api, u } from '@converse/headless';

/**
 * @param {import('../reaction-picker').default} el
 */
export default (el) => {
    // Use the PopularReactions model if available, otherwise fall back to the setting
    const popular_reactions = _converse.state.popular_reactions;
    let popular_emojis;

    if (popular_reactions && Object.keys(popular_reactions.getFrequencies()).length > 0) {
        // Get the most frequently used emojis from the model
        // Use the same length as the default setting to respect user's configured list size
        const default_setting = api.settings.get('popular_reactions') ?? [];
        popular_emojis = popular_reactions.getSortedEmojis(default_setting.length);
    } else {
        // Fall back to the default setting
        popular_emojis = api.settings.get('popular_reactions');
    }

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
                                          'current_category',
                                      ) || ''}"
                                      current_skintone="${el.model.collection.chatbox.emoji_picker.get(
                                          'current_skintone',
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
