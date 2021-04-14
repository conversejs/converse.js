import { html } from "lit";
import tpl_command_form from './ad-hoc-command-form.js';

export default (o, command) => html`
    <li class="room-item list-group-item">
        <div class="available-chatroom d-flex flex-row">
            <a class="open-room available-room w-100"
               @click=${o.toggleCommandForm}
               data-command-node="${command.node}"
               data-command-jid="${command.jid}"
               data-command-name="${command.name}"
               title="${command.name}"
               href="#">${command.name || command.jid}</a>
        </div>
        ${ command.node === o.showform ? tpl_command_form(o, command) : '' }
    </li>
`;
