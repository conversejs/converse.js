import { _converse, api } from '@converse/headless';
import { html } from 'lit';
import { CustomElement } from './element.js';
import { __ } from 'i18n';

export class ConverseFooter extends CustomElement {
    render() {
        const is_fullscreen = api.settings.get('view_mode') === 'fullscreen';
        const theme = api.settings.get('theme');
        const is_dark_theme = ['dracula', 'cyberpunk'].includes(theme);
        const i18n_sponsors = __('A big thank you to our sponsors 🙏');
        return html`
            ${is_fullscreen
                ? html`
                      <footer class="footer mt-auto py-3 mb-2">
                          <div class="container">
                              <div class="row">
                                  <div class="col-12 text-center">
                                      <p class="brand-subtitle mb-2 subdued">Version: ${_converse.VERSION_NAME}</p>
                                      <p class="brand-subtitle mb-2">
                                          <a
                                              target="_blank"
                                              rel="nofollow"
                                              href="https://github.com/conversejs/converse.js"
                                              >Open Source</a
                                          >
                                          XMPP chat client brought to you by
                                          <a target="_blank" rel="nofollow" href="https://opkode.com">Opkode</a>.
                                      </p>
                                      <p class="brand-subtitle mb-4">
                                          You can
                                          <a target="_blank" rel="nofollow" href="https://opkode.com/contact.html"
                                              >hire me</a
                                          >
                                          for customizations, support or to build your next project.
                                      </p>
                                      <div class="sponsors text-center">
                                          <p class="byline mb-1">${i18n_sponsors}</p>
                                          <div
                                              class="fs-6 d-flex flex-wrap justify-content-center align-items-center gap-4 mb-2"
                                          >
                                              <div>
                                                  <a
                                                      href="https://bairesdev.com/sponsoring-open-source-projects/?utm_source=conversejs"
                                                      target="_blank"
                                                      rel="noopener"
                                                      ><img
                                                          style="width: 13em"
                                                          src="/media/logos/bairesdev-primary.png"
                                                          alt="BairesDev"
                                                  /></a>
                                              </div>
                                              <div>
                                                  <a
                                                      href="https://blokt.com?utm_source=conversejs"
                                                      target="_blank"
                                                      rel="noopener"
                                                      ><img
                                                          style="width: 12em"
                                                          src="${is_dark_theme
                                                              ? '/media/logos/blokt-invert.png'
                                                              : '/media/logos/blokt.png'}"
                                                          alt="Blokt Crypto & Privacy"
                                                  /></a>
                                              </div>
                                              <div>
                                                  <a
                                                      href="https://www.keycdn.com?utm_source=conversejs"
                                                      target="_blank"
                                                      rel="noopener"
                                                      ><img style="height: 3em" src="/logo/keycdn.svg" alt="KeyCDN"
                                                  /></a>
                                              </div>
                                          </div>
                                      </div>

                                      <p class="brand-subtitle mb-3">
                                          If you'd like to sponsor this project, please visit:
                                          <a href="https://github.com/sponsors/jcbrand" target="_blank" rel="noopener"
                                              >Github</a
                                          >,
                                          <a href="https://www.patreon.com/jcbrand" target="_blank" rel="noopener"
                                              >Patreon</a
                                          >,
                                          <a href="https://liberapay.com/jcbrand" target="_blank" rel="noopener"
                                              >Liberapay</a
                                          >
                                          or
                                          <a href="https://opkode.com/contact.html" target="_blank" rel="noopener"
                                              >contact us</a
                                          >.
                                      </p>
                                  </div>
                              </div>
                          </div>
                      </footer>
                  `
                : ''}
        `;
    }
}

api.elements.define('converse-footer', ConverseFooter);
