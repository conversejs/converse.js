import { html } from "lit-html";


export default (o) => html`
    <div class="message date-separator" data-isodate="${o.time}">
        <hr class="separator"/>
        <time class="separator-text" datetime="${o.time}"><span>${o.datestring}</span></time>
    </div>
`;
