import { html, nothing } from 'lit';

// The frame brings its own styles, so it looks the same wherever it's rendered.
import '../styles/composer-panel.scss';

/**
 * Draws the frame that every composer panel shares: the coloured left border
 * that says what kind of panel it is, an optional icon, the content, optional
 * actions, and the close button in the top-right corner.
 *
 * Escape while focus is inside the panel runs its close action. After a close
 * from the keyboard, focus goes back to the message field.
 *
 * @param {Object} options
 * @param {'context'|'warning'|'tool'} options.kind - Sets the colour of the left border.
 * @param {import('lit').TemplateResult} [options.icon]
 * @param {import('lit').TemplateResult} options.content
 * @param {import('lit').TemplateResult} [options.actions]
 * @param {{ label: string, handler: (ev: Event) => void }} [options.close] - The close
 *  action, and the accessible name of its button.
 * @param {string} [options.role] - The frame's ARIA role, if it has one.
 * @param {string} [options.label] - The frame's ARIA label, if it has one.
 */
export default ({ kind, icon, content, actions, close, role, label }) => html`
    <div
        class="composer-panel composer-panel--${kind} ${close ? 'composer-panel--closable' : ''}"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
        @keydown=${close ? (/** @type {KeyboardEvent} */ ev) => onEscape(ev, close) : nothing}
    >
        ${icon ? html`<span class="composer-panel__icon">${icon}</span>` : nothing}
        <div class="composer-panel__body">${content}</div>
        ${actions ? html`<div class="composer-panel__actions">${actions}</div>` : nothing}
        ${close ? tplCloseButton(close) : nothing}
    </div>
`;

/**
 * @param {{ label: string, handler: (ev: Event) => void }} close
 */
function tplCloseButton(close) {
    return html`<button
        type="button"
        class="composer-panel__close"
        aria-label="${close.label}"
        title="${close.label}"
        @click=${(/** @type {MouseEvent} */ ev) => closePanel(ev, close)}
    >
        <converse-icon class="fa fa-times" size="0.875em"></converse-icon>
    </button>`;
}

/**
 * @param {KeyboardEvent} ev
 * @param {{ handler: (ev: Event) => void }} close
 */
function onEscape(ev, close) {
    if (ev.key !== 'Escape') return;

    ev.preventDefault();
    ev.stopPropagation();
    closePanel(ev, close);
}

/**
 * Runs the close action. A close from the keyboard first fires a bubbling
 * `composerpanelclose` event, so that whoever owns the message field can move
 * focus there, because the control that held it may be about to disappear.
 * A pointer close leaves focus alone, so that a tap doesn't open the
 * on-screen keyboard.
 * @param {Event} ev
 * @param {{ handler: (ev: Event) => void }} close
 */
function closePanel(ev, close) {
    // Enter or Space on the button fires a click whose detail is 0.
    const from_keyboard = ev instanceof KeyboardEvent || (ev instanceof MouseEvent && ev.detail === 0);
    if (from_keyboard) {
        ev.currentTarget.dispatchEvent(new CustomEvent('composerpanelclose', { bubbles: true }));
    }
    close.handler(ev);
}
