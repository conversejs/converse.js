import { html } from "lit-html";

const tpl_headline_box = (o) => html`
    <div class="list-item controlbox-padded d-flex flex-row"
        data-headline-jid="${o.headlinebox.get('jid')}">
    <a class="list-item-link open-headline available-room w-100"
        data-headline-jid="${o.headlinebox.get('jid')}"
        title="${o.open_title}" href="#">${o.headlinebox.get('jid')}</a>
    </div>
`;


export default (o) => html`
    <div class="list-container list-container--headline ${ o.headlineboxes.length ? '' : 'hidden' }">
        <div class="items-list rooms-list headline-list">
            ${ o.headlineboxes.map(headlinebox => tpl_headline_box(Object.assign({headlinebox}, o))) }
        </div>
    </div>
`;
