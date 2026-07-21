import { html } from 'lit';
import 'shared/avatar/avatar.js';

/**
 * The inline caret-typeahead menu (emoji shortnames, mentions), anchored just below the
 * caret. Each row shows an optional glyph (or a custom emoji's image), the label, and
 * optional muted detail text.
 *
 * `mousedown` is prevented so picking with the mouse never blurs the editor, which would
 * collapse the caret before the replacement runs.
 *
 * @param {import('../typeahead.js').TypeaheadController} ac
 */
export default (ac) => html`<ul class="rich-ac" role="listbox" style="${ac.style}">
    ${ac.items.map(
        (item, i) => html`<li
            role="option"
            aria-selected=${i === ac.index ? 'true' : 'false'}
            class="rich-ac__item ${i === ac.index ? 'is-active' : ''}"
            @mousedown=${(/** @type {MouseEvent} */ ev) => {
                ev.preventDefault();
                ac.choose(i);
            }}
        >
            ${item.avatar
                ? html`<converse-avatar
                      .model=${item.avatar}
                      name="${item.label}"
                      height="22"
                      width="22"
                      class="avatar rich-ac__avatar"
                  ></converse-avatar>`
                : ''}
            ${item.url || item.glyph
                ? html`<span class="rich-ac__glyph">
                      ${item.url ? html`<img class="rich-ac__img" src="${item.url}" alt="${item.label}" />` : item.glyph}
                  </span>`
                : ''}
            <span class="rich-ac__label">${item.label}</span>
            ${item.detail ? html`<span class="rich-ac__detail">${item.detail}</span>` : ''}
        </li>`,
    )}
</ul>`;
