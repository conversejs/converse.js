/**
 * @typedef {import('@converse/headless/types/plugins/adhoc/utils').AdHocCommand} AdHocCommand
 * @typedef {import('../adhoc-commands').default} AdHocCommands
 * @typedef {import('../adhoc-commands').AdHocCommandUIProps} AdHocCommandUIProps
 */
import { html } from "lit";
import tplCommandForm from './ad-hoc-command-form.js';

/**
 * @param {AdHocCommands} el
 * @param {AdHocCommandUIProps} command
 */
export default (el, command) => html`
    <li class="room-item list-group-item">
        <div class="available-chatroom d-flex flex-row">
            <a class="open-room available-room w-100"
               @click=${(ev) => el.toggleCommandForm(ev)}
               data-command-node="${command.node}"
               data-command-jid="${command.jid}"
               data-command-name="${command.name}"
               title="${command.name}"
               href="#">${command.name || command.jid}</a>
        </div>
        ${ command.node === el.showform ? tplCommandForm(el, command) : '' }
    </li>
`;
