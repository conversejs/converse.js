import DOMPurify from 'dompurify';
import { html } from 'lit';
import { _converse, api } from '@converse/headless';
import { __ } from 'i18n';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

/**
 * @param {import('../user-settings').default} el
 */
const tplNavigation = (el) => {
    const i18n_about = __('About');
    const i18n_commands = __('Commands');
    const i18n_services = __('Services');
    const show_client_info = api.settings.get('show_client_info');
    const allow_adhoc_commands = api.settings.get('allow_adhoc_commands');
    const has_disco_browser = _converse.pluggable.plugins['converse-disco-views']?.enabled(_converse);
    const show_tabs = (show_client_info ? 1 : 0) + (allow_adhoc_commands ? 1 : 0) + (has_disco_browser ? 1 : 0) >= 2;
    return html`
        ${show_tabs
            ? html`<ul class="nav nav-pills justify-content-center">
                  ${show_client_info
                      ? html`<li role="presentation" class="nav-item">
                            <a
                                class="nav-link ${el.tab === 'about' ? 'active' : ''}"
                                id="about-tab"
                                href="#about-tabpanel"
                                aria-controls="about-tabpanel"
                                role="tab"
                                data-toggle="tab"
                                data-name="about"
                                @click=${(ev) => el.switchTab(ev)}
                                >${i18n_about}</a
                            >
                        </li>`
                      : ''}
                  ${allow_adhoc_commands
                      ? html`<li role="presentation" class="nav-item">
                            <a
                                class="nav-link ${el.tab === 'commands' ? 'active' : ''}"
                                id="commands-tab"
                                href="#commands-tabpanel"
                                aria-controls="commands-tabpanel"
                                role="tab"
                                data-toggle="tab"
                                data-name="commands"
                                @click=${(ev) => el.switchTab(ev)}
                                >${i18n_commands}</a
                            >
                        </li>`
                      : ''}
                  ${has_disco_browser
                      ? html`<li role="presentation" class="nav-item">
                            <a
                                class="nav-link ${el.tab === 'disco' ? 'active' : ''}"
                                id="server-tab"
                                href="#server-tabpanel"
                                aria-controls="server-tabpanel"
                                role="tab"
                                data-toggle="tab"
                                data-name="disco"
                                @click=${(ev) => el.switchTab(ev)}
                                >${i18n_services}</a
                            >
                        </li>`
                      : ''}
              </ul>`
            : ''}
    `;
};

/**
 * @param {import('../user-settings').default} el
 */
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
        ${show_both_tabs ? tplNavigation(el) : ''}

        <div class="tab-content">
            ${show_client_info
                ? html`<div
                      class="tab-pane tab-pane--columns ${el.tab === 'about' ? 'active' : ''}"
                      id="about-tabpanel"
                      role="tabpanel"
                      aria-labelledby="about-tab"
                  >
                      <div class="container">
                          <converse-brand-logo
                              class="d-flex justify-content-center mt-3"
                              hide_byline
                          ></converse-brand-logo>
                          <p class="text-center brand-subtitle">${_converse.VERSION_NAME}</p>
                          <p class="text-center brand-subtitle">${unsafeHTML(DOMPurify.sanitize(first_subtitle))}</p>
                          <p class="text-center brand-subtitle">${unsafeHTML(DOMPurify.sanitize(second_subtitle))}</p>
                      </div>
                  </div>`
                : ''}
            ${allow_adhoc_commands
                ? html`
                      <div
                          class="tab-pane tab-pane--columns ${el.tab === 'commands' ? 'active' : ''}"
                          id="commands-tabpanel"
                          role="tabpanel"
                          aria-labelledby="commands-tab"
                      >
                          <converse-adhoc-commands />
                      </div>
                  `
                : ''}
            ${_converse.pluggable.plugins['converse-disco-views']?.enabled(_converse)
                ? html` <div
                      class="tab-pane tab-pane--columns ${el.tab === 'disco' ? 'active' : ''}"
                      id="server-tabpanel"
                      role="tabpanel"
                      aria-labelledby="server-tab"
                  >
                      ${el.tab === 'disco' ? html`<converse-disco-browser></converse-disco-browser>` : ''}
                  </div>`
                : ''}
        </div>
    `;
};
