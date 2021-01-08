import { html } from 'lit-html';
import { api } from '@converse/headless/core';

export default (o) => html`
    <div class="flyout box-flyout">
        <converse-dragresize></converse-dragresize>
        <div class="chat-head controlbox-head">
            ${o.sticky_controlbox ? '' : html`<a class="chatbox-btn close-chatbox-button fa fa-times"></a>` }
        </div>
        <div class="controlbox-panes">
            ${ api.connection.connected() ? html`
                <converse-headlines-panel></converse-headlines-panel>
                <converse-rooms-list></converse-rooms-list>
                <converse-bookmarks></converse-bookmarks>` : '' }
        </div>
    </div>
`;
