import { html } from "lit-html";


export default (o) => html`
    <div class="message chat-info chat-state-notification"
        data-isodate="${o.isodate}"
        data-csn="${o.from}">${o.message}</div>
`;
