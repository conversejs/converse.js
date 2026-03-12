import { html } from 'lit';
import { u } from '@converse/headless';

export default (data) => {
    const anchor_name = `--reaction-anchor-${data.picker_id}`;
    const filtered_emojis = data.allowed_emojis ? 
        data.popular_emojis.filter(sn => data.allowed_emojis.includes(u.shortnamesToEmojis(sn))) : 
        data.popular_emojis;

    return html`
        <div class="reaction-picker popular ${data.dropup ? 'dropup' : ''} ${data.shifted ? 'shifted' : ''} 
             ${data.closing ? 'closing' : ''}">
            ${filtered_emojis.map(sn => html`
                <button class="reaction-item" @click=${() => data.onEmojiSelected(sn)}>
                    ${u.shortnamesToEmojis(sn)}
                </button>
            `)}
            
            <div class="dropdown emoji-picker__dropdown">
                <button class="reaction-item more dropdown-toggle" 
                        type="button" 
                        id="${data.picker_id}-dropdown" 
                        style="anchor-name: ${anchor_name}"
                        data-bs-toggle="dropdown" 
                        aria-expanded="false"
                        @click=${data.initEmojiPicker}>
                    <converse-icon class="fas fa-plus" size="1em"></converse-icon>
                </button>
                <ul class="dropdown-menu" aria-labelledby="${data.picker_id}-dropdown" 
                    style="position-anchor: ${anchor_name}">
                    <li>
                        ${data.emoji_picker_state ? html`
                            <converse-emoji-picker
                                .state=${data.emoji_picker_state}
                                .model=${data.model.collection.chatbox}
                                .allowed_emojis=${data.allowed_emojis}
                                @emojiSelected=${(ev) => {
                                    ev.stopPropagation();
                                    data.onEmojiSelected(ev.detail.value);
                                }}
                                ?render_emojis=${true}
                                current_category="${data.emoji_picker_state.get('current_category') || ''}"
                                current_skintone="${data.emoji_picker_state.get('current_skintone') || ''}"
                                query="${data.emoji_picker_state.get('query') || ''}"
                            ></converse-emoji-picker>
                        ` : ''}
                    </li>
                </ul>
            </div>
        </div>
    `;
};

