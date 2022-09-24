import DOMPurify from 'dompurify';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core.js";
import { html } from "lit";
import { unsafeHTML } from 'lit/directives/unsafe-html.js';


const tpl_navigation = (el) => {
    const i18n_about = __('About');
    const i18n_commands = __('Commands');
    return html`
        <ul class="nav nav-pills justify-content-center">
            <li role="presentation" class="nav-item">
                <a class="nav-link ${el.tab === "about" ? "active" : ""}"
                   id="about-tab"
                   href="#about-tabpanel"
                   aria-controls="about-tabpanel"
                   role="tab"
                   data-toggle="tab"
                   data-name="about"
                   @click=${ev => el.switchTab(ev)}>${i18n_about}</a>
            </li>
            <li role="presentation" class="nav-item">
                <a class="nav-link ${el.tab === "commands" ? "active" : ""}"
                   id="commands-tab"
                   href="#commands-tabpanel"
                   aria-controls="commands-tabpanel"
                   role="tab"
                   data-toggle="tab"
                   data-name="commands"
                   @click=${ev => el.switchTab(ev)}>${i18n_commands}</a>
            </li>
        </ul>
    `;
}


export default (el) => {
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
    const show_client_info = api.settings.get('show_client_info');
    const allow_adhoc_commands = api.settings.get('allow_adhoc_commands');
    const show_both_tabs = show_client_info && allow_adhoc_commands;

    return html`
        ${ show_both_tabs ? tpl_navigation(el) : '' }

        <div class="tab-content">
            ${ show_client_info ? html`
                <div class="tab-pane tab-pane--columns ${ el.tab === 'about' ? 'active' : ''}"
                        id="about-tabpanel" role="tabpanel" aria-labelledby="about-tab">

                    <span class="modal-alert"></span>
                    <br/>
                    <div class="container">
                        <h6 class="brand-heading">Converse</h6>
                        <p class="brand-subtitle">${_converse.VERSION_NAME}</p>
                        <p class="brand-subtitle">${unsafeHTML(DOMPurify.sanitize(first_subtitle))}</p>
                        <p class="brand-subtitle">${unsafeHTML(DOMPurify.sanitize(second_subtitle))}</p>
                    </div>
                </div>` : '' }

            ${ allow_adhoc_commands ? html`
                <div class="tab-pane tab-pane--columns ${ el.tab === 'commands' ? 'active' : ''}"
                        id="commands-tabpanel"
                        role="tabpanel"
                        aria-labelledby="commands-tab">
                    <converse-adhoc-commands/>
                </div> ` : '' }
        </div>
`};
