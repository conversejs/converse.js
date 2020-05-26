import { html } from 'lit-html';

export default (o) => html`
  <div class="bottom-panel">
    ${o.entered
      ? html`
        ${o.can_edit
          ? html`
            <div class="emoji-picker__container dropup"></div>
            <div class="message-form-container">
          ` : html`<div class="muc-bottom-panel">${o.i18n_not_allowed}</div>`
        }
      ` : html`<div class="muc-bottom-panel"></div>`
    }
  </div>
`;
