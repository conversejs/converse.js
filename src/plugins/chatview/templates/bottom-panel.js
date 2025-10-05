import { __ } from 'i18n';
import { api } from '@converse/headless';
import { html } from 'lit';


export default (o) => {
    const unread_msgs = __('You have unread messages');
    const max_duration = api.settings.get('max_voice_message_duration') || 300;
    const bitrate = api.settings.get('voice_message_bitrate') || 128000;
    
    return html`
        ${ o.model.ui.get('scrolled') && o.model.get('num_unread') ?
            html`<div class="new-msgs-indicator" @click=${(ev) => o.viewUnreadMessages(ev)}>▼ ${ unread_msgs } ▼</div>` : '' }
        
        ${ o.show_voice_recorder ? html`
            <converse-audio-recorder
                .model=${o.model}
                maxDuration="${max_duration}"
                bitrate="${bitrate}"
                @recording-stopped=${o.handleRecordingCompleted}
                @recording-cancelled=${o.hideVoiceRecorder}
            ></converse-audio-recorder>
        ` : '' }
        
        <converse-message-form .model=${o.model}></converse-message-form>
    `;
}
