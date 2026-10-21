import { __ } from 'i18n';
import { api } from '@converse/headless';
import { html } from 'lit';

/**
 * @param {import('../bottom-panel').default} el
 */
export default (el) => {
    const unread_msgs = __('You have unread messages');
    const max_duration = api.settings.get('max_voice_message_duration') || 300;
    const bitrate = api.settings.get('voice_message_bitrate') || 128000;

    return html`
        ${
            el.model.ui.get('scrolled') && el.model.get('num_unread')
                ? html`<div
                      class="new-msgs-indicator"
                      @click=${/** @param {MouseEvent} ev */ (ev) => el.viewUnreadMessages(ev)}
                  >
                      ▼ ${unread_msgs} ▼
                  </div>`
                : ''
        }
        ${
            el.model.get('show_voice_recorder')
                ? html`
                      <converse-audio-recorder
                          .model=${el.model}
                          maxDuration="${max_duration}"
                          bitrate="${bitrate}"
                          @recording-stopped=${(ev) => el.handleRecordingCompleted(ev)}
                          @recording-cancelled=${() => el.hideVoiceRecorder()}
                      ></converse-audio-recorder>
                  `
                : ''
        }

        <converse-reply-preview .model=${el.model}></converse-reply-preview>
        <converse-message-form .model=${el.model}></converse-message-form>
    `;
};
