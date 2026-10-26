/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Record voice messages and send them via XEP-0363 HTTP File Upload.
 */
import { api, converse } from '@converse/headless';
import { getRecorderPanel, getVoiceMessageItem } from './utils.js';
import './recorder.js';

import './styles/recorder.scss';

converse.plugins.add('converse-voice-messages', {
    dependencies: ['converse-chatview', 'converse-muc-views'],

    initialize() {
        api.settings.extend({
            max_voice_message_duration: 0, // seconds, 0 for no limit beyond what the upload service accepts
            voice_message_bitrate: 32000, // bits per second, plenty for speech
            // MP4 audio is saved as .m4a, the extension XMPP clients such as Conversations recognise as audio
            voice_message_mime_type: 'audio/mp4',
            visible_toolbar_buttons: { voice_message: true },
        });

        api.listen.on('getAttachmentMenuItems', getVoiceMessageItem);
        api.listen.on('getComposerPanels', getRecorderPanel);
    },
});
