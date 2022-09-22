import { html } from "lit";


export default (o) => html`
    <div class="modal-body">
        <span class="modal-alert"></span>
        ${ o.messages.map(message => html`<p>${message}</p>`) }
    </div>`;
