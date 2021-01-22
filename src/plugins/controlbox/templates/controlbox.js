import { html } from 'lit-html';

export default (o) => html`
    <div class="flyout box-flyout">
        <converse-dragresize></converse-dragresize>
        <div class="chat-head controlbox-head">
            ${o.sticky_controlbox ? '' : html`<a class="chatbox-btn close-chatbox-button fa fa-times"></a>` }
        </div>
        <div class="controlbox-panes">
            ${ o.connected
                ? html`
                    <div class="controlbox-pane">
                        <converse-user-profile></converse-user-profile>
                        <converse-headlines-panel></converse-headlines-panel>
                        <converse-rooms-list></converse-rooms-list>
                        <converse-bookmarks></converse-bookmarks>
                    </div>`
                : (
                    o['active-form'] === 'register'
                        ? html`<converse-login-panel></converse-login-panel>`
                        : html`<converse-register-panel></converse-headlines-panel>`
                  )
            }
        </div>
    </div>
`;
