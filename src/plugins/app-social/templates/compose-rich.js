import { html } from 'lit';
import { __ } from 'i18n';

/**
 * A format-toolbar button, rendered with a `converse-icon` from the SVG sprite
 * `mousedown` is prevented so clicking the button doesn't steal the editor's
 * selection before the format command runs.
 * @param {import('../compose-rich.js').default} el
 */
const fmtButton = (el, type, label, icon) =>
    html`<button
        type="button"
        class="social-rich__fmt social-rich__fmt--${type}"
        title="${label}"
        aria-label="${label}"
        @mousedown=${(/** @type {MouseEvent} */ ev) => ev.preventDefault()}
        @click=${() => el.onFormat(type)}
    >
        <converse-icon size="1em" class="fa fa-${icon}"></converse-icon>
    </button>`;

/**
 * @param {import('../compose-rich.js').default} el
 */
export default (el) => html`
    <div class="social-compose social-compose--rich">
        <div class="social-rich">
            <!-- Stable host: no dynamic bindings inside, so Lit never re-renders it
                 and Lexical's managed DOM survives the component's state changes. -->
            <div
                class="social-rich__editable"
                contenteditable="true"
                role="textbox"
                aria-multiline="true"
                aria-label="${__('Write a post')}"
                @focusin=${() => el.ensureEditor()}
                @paste=${(/** @type {ClipboardEvent} */ ev) => el.onPaste(ev)}
            ></div>
            ${el._empty ? html`<span class="social-rich__placeholder">${__('What’s on your mind?')}</span>` : ''}
        </div>

        ${el._attachments.length || el._uploading
            ? html`<div class="social-rich__attachments">
                  ${el._attachments.map(
                      (att, i) => html`<div class="social-rich__attachment" title="${att.title ?? ''}">
                          ${att.type?.startsWith('image/')
                              ? html`<img
                                    class="social-rich__attachment-thumb"
                                    src="${att.href}"
                                    alt="${att.title ?? ''}"
                                />`
                              : html`<span class="social-rich__attachment-name">
                                    <converse-icon size="1em" class="fa fa-paperclip"></converse-icon>
                                    ${att.title ?? att.href}
                                </span>`}
                          <button
                              type="button"
                              class="social-rich__attachment-remove"
                              title="${__('Remove attachment')}"
                              aria-label="${__('Remove attachment')}"
                              @click=${() => el.removeAttachment(i)}
                          >
                              <converse-icon size="0.8em" class="fa fa-times"></converse-icon>
                          </button>
                      </div>`,
                  )}
                  ${el._uploading
                      ? html`<span class="social-rich__uploading">${__('Uploading…')}</span>`
                      : ''}
              </div>`
            : ''}

        <div class="social-rich__toolbar">
            ${fmtButton(el, 'bold', __('Bold'), 'bold')} ${fmtButton(el, 'italic', __('Italic'), 'italic')}
            ${fmtButton(el, 'strikethrough', __('Strikethrough'), 'strikethrough')}
            ${fmtButton(el, 'code', __('Monospace'), 'code')}

            <converse-social-emoji-dropdown
                .model=${el.model}
                @emojipicked=${(/** @type {CustomEvent} */ ev) => el.onEmoji(ev.detail.text)}
            ></converse-social-emoji-dropdown>

            <button
                type="button"
                class="social-rich__fmt social-rich__attach"
                title="${__('Attach a file')}"
                aria-label="${__('Attach a file')}"
                ?disabled=${el._uploading}
                @mousedown=${(/** @type {MouseEvent} */ ev) => ev.preventDefault()}
                @click=${() => /** @type {HTMLInputElement} */ (el.querySelector('.social-rich__file-input'))?.click()}
            >
                <converse-icon size="1em" class="fa fa-paperclip"></converse-icon>
            </button>
            <input
                type="file"
                class="social-rich__file-input"
                multiple
                hidden
                @change=${(/** @type {Event} */ ev) => {
                    const input = /** @type {HTMLInputElement} */ (ev.target);
                    el.onAttach(input.files);
                    input.value = '';
                }}
            />

            <span class="social-rich__spacer"></span>

            <button
                type="button"
                class="btn btn-primary social-rich__post"
                ?disabled=${el._publishing || el._uploading || (el._empty && !el._attachments.length)}
                @click=${(/** @type {Event} */ ev) => el.onSubmit(ev)}
            >
                ${el._publishing ? __('Posting…') : __('Post')}
            </button>
        </div>
    </div>
`;
