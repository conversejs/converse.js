/* eslint-disable max-len */
import { html } from 'lit';
import { api } from '@converse/headless';

/**
 * @param {import('../background').default} el
 */
export default (el) => html`
    ${
        api.settings.get('theme') === 'cyberpunk'
            ? html`<section class="moving-grid">
                  <div class="container">
                      <div class="static-lines">
                          ${[...Array(20).keys()].map(() => html`<div class="vert"></div> `)}
                      </div>
                      <div class="moving-lines">
                          ${[...Array(60).keys()].map(() => html`<div class="horz"></div> `)}
                      </div>
                  </div>
              </section>`
            : ''
    } ${
        el.getAttribute('logo')
            ? html`
                  <div class="inner-content converse-brand row">
                      <div class="converse-brand__heading">
                          <converse-logo></converse-logo>
                          <span class="converse-brand__text">
                              <span>converse<span class="subdued">.js</span></span>
                              <p class="byline">messaging freedom</p>
                          </span>
                      </div>
                      ${api.settings.get('view_mode') === 'overlayed'
                          ? html`<div class="converse-brand__padding"></div>`
                          : ''}
                  </div>
              `
            : ''
    }
    </div>
`;
