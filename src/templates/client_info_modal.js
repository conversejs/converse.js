import { __ } from '@converse/headless/i18n';
import { html } from "lit-html";
import { modal_header_close_button } from "./buttons"
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import xss from "xss/dist/xss";


const modal_title = __('About');

const first_subtitle = __(
    '%1$s Open Source %2$s XMPP chat client brought to you by %3$s Opkode %2$s',
    '<a target="_blank" rel="nofollow" href="https://conversejs.org">',
    '</a>',
    '<a target="_blank" rel="nofollow" href="https://opkode.com">'
);

const second_subtitle = __(
    '%1$s Translate %2$s it into your own language',
    '<a target="_blank" rel="nofollow" href="https://hosted.weblate.org/projects/conversejs/#languages">',
    '</a>'
);


export default (o) => html`
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="changeStatusModalLabel">${modal_title}</h5>
                ${modal_header_close_button}
            </div>
            <div class="modal-body">
                <span class="modal-alert"></span>
                <div class="container brand-heading-container">
                    <h6 class="brand-heading">Converse</h6>
                    <p class="brand-subtitle">${o.version_name}</p>
                    <p class="brand-subtitle">${unsafeHTML(xss.filterXSS(first_subtitle, {'whiteList': {'a': []}}))}</p>
                    <p class="brand-subtitle">${unsafeHTML(xss.filterXSS(second_subtitle, {'whiteList': {'a': []}}))}</p>
                </div>
            </div>
        </div>
    </div>
`;
