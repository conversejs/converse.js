import { __ } from '@converse/headless/i18n';
import { html } from "lit-html";
import { modal_header_close_button } from "./buttons"
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import '../components/adhoc-commands.js';
import xss from "xss/dist/xss";


const i18n_modal_title = __('Settings');
const i18n_about = __('About');
const i18n_commands = __('Commands');

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

const tpl_navigation = (o) => html`
    <ul class="nav nav-pills justify-content-center">
        <li role="presentation" class="nav-item">
            <a class="nav-link active" id="about-tab" href="#about-tabpanel" aria-controls="about-tabpanel" role="tab" data-toggle="tab" @click=${o.switchTab}>${i18n_about}</a>
        </li>
        <li role="presentation" class="nav-item">
            <a class="nav-link" id="commands-tab" href="#commands-tabpanel" aria-controls="commands-tabpanel" role="tab" data-toggle="tab" @click=${o.switchTab}>${i18n_commands}</a>
        </li>
    </ul>
`;


export default (o) => html`
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="converse-modtools-modal-label">${i18n_modal_title}</h5>
                ${modal_header_close_button}
            </div>
            <div class="modal-body">
                ${ tpl_navigation(o) }

                <div class="tab-content">
                    <div class="tab-pane tab-pane--columns active" id="about-tabpanel" role="tabpanel" aria-labelledby="about-tab">
                        <span class="modal-alert"></span>
                        <br/>
                        <div class="container brand-heading-container">
                            <h6 class="brand-heading">Converse</h6>
                            <p class="brand-subtitle">${o.version_name}</p>
                            <p class="brand-subtitle">${unsafeHTML(xss.filterXSS(first_subtitle, {'whiteList': {'a': []}}))}</p>
                            <p class="brand-subtitle">${unsafeHTML(xss.filterXSS(second_subtitle, {'whiteList': {'a': []}}))}</p>
                        </div>
                    </div>

                    <div class="tab-pane tab-pane--columns" id="commands-tabpanel" role="tabpanel" aria-labelledby="commands-tab">
                        <converse-adhoc-commands/>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
