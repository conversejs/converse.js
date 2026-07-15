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
            ></div>
            ${el._empty ? html`<span class="social-rich__placeholder">${__('What’s on your mind?')}</span>` : ''}
        </div>

        <div class="social-rich__toolbar">
            ${fmtButton(el, 'bold', __('Bold'), 'bold')} ${fmtButton(el, 'italic', __('Italic'), 'italic')}
            ${fmtButton(el, 'strikethrough', __('Strikethrough'), 'strikethrough')}
            ${fmtButton(el, 'code', __('Monospace'), 'code')}

            <span class="social-rich__spacer"></span>

            <button
                type="button"
                class="btn btn-primary social-rich__post"
                ?disabled=${el._publishing || el._empty}
                @click=${(/** @type {Event} */ ev) => el.onSubmit(ev)}
            >
                ${el._publishing ? __('Posting…') : __('Post')}
            </button>
        </div>
    </div>
`;
