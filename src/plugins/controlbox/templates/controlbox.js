import { html } from 'lit-html';

export default o => html`
    <div class="flyout box-flyout">
        <converse-dragresize></converse-dragresize>
        <div class="chat-head controlbox-head">
            ${o.sticky_controlbox
                ? ''
                : html`
                      <a class="chatbox-btn close-chatbox-button fa fa-times"></a>
                  `}
        </div>
        <div class="controlbox-panes">
            <div class="controlbox-pane">
                ${o.connected
                    ? html`
                          <converse-user-profile></converse-user-profile>
                          <converse-headlines-panel></converse-headlines-panel>
                          <converse-rooms-list></converse-rooms-list>
                          <converse-bookmarks></converse-bookmarks>`
                    : o['active-form'] === 'register'
                        ? html`<converse-register-panel></converse-register-panel>`
                        : html`<converse-login-panel></converse-login-panel>`
                }
            </div>
        </div>
    </div>
`;
