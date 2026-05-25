import { createPopper } from '@popperjs/core';
import log from '@converse/log';
import { CustomElement } from './element.js';

export default class DropdownBase extends CustomElement {
    /**
     * @param {import('lit').PropertyValues} changed
     */
    firstUpdated(changed) {
        super.firstUpdated(changed);
        this.menu = /** @type { HTMLElement|null} */ (this.querySelector('.dropdown-menu'));
        this.button = /** @type {HTMLButtonElement} */ (this.querySelector('button'));

        /** @param {MouseEvent} ev */
        this._onButtonClick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this.toggle();
        };
        this.button.addEventListener('click', this._onButtonClick);
    }

    connectedCallback() {
        super.connectedCallback();
        this.registerEvents();
    }

    disconnectedCallback() {
        this.unregisterEvents();
        if (this._onButtonClick) {
            this.button?.removeEventListener('click', this._onButtonClick);
        }
        if (this._onDocumentClick) {
            document.removeEventListener('click', this._onDocumentClick);
        }
        this._popper?.destroy();
        super.disconnectedCallback();
    }

    /**
     * Override in subclass to register event listeners.
     * Called automatically from connectedCallback().
     */
    registerEvents() {}

    /**
     * Override in subclass to unregister event listeners.
     * Called automatically from disconnectedCallback().
     */
    unregisterEvents() {}

    /** Toggle the dropdown's visibility */
    toggle() {
        if (!this.menu) {
            log.error('DropdownBase.toggle called but this.menu is not set');
            return;
        }
        return this.menu.classList.contains('show') ? this.hide() : this.show();
    }

    /** Show the dropdown */
    show() {
        const menu = this.menu;
        if (!menu) {
            log.error('DropdownBase.show called but this.menu is not set');
            return;
        }
        if (menu.classList.contains('show')) return;

        this.button?.classList.add('show');
        this.button?.setAttribute('aria-expanded', 'true');
        menu.classList.add('show');

        if (this.classList.contains('dropstart')) {
            this._popper = createPopper(this.button, menu, {
                strategy: 'fixed',
                placement: 'left-start',
            });
        } else {
            this._popper = createPopper(this.button, menu, {
                placement: 'bottom-start',
                modifiers: [{ name: 'flip' }, { name: 'offset', options: { offset: [0, 4] } }],
            });
        }

        this._onDocumentClick = /** @param {MouseEvent} ev */ (ev) => {
            if (!this.contains(/** @type {Node} */ (ev.target))) {
                this.hide();
            }
        };
        document.addEventListener('click', this._onDocumentClick);

        this.dispatchEvent(new CustomEvent('converse:dropdown:show', { bubbles: true }));
    }

    /** Hide the dropdown */
    hide() {
        const menu = this.menu;
        if (!menu) {
            log.error('DropdownBase.hide called but this.menu is not set');
            return;
        }
        if (!menu.classList.contains('show')) return;

        this.button?.setAttribute('aria-expanded', 'false');
        this.button?.classList.remove('show');
        menu.classList.remove('show');

        this._popper?.destroy();
        this._popper = null;

        if (this._onDocumentClick) {
            document.removeEventListener('click', this._onDocumentClick);
            this._onDocumentClick = null;
        }

        this.dispatchEvent(new CustomEvent('converse:dropdown:hide', { bubbles: true }));
    }
}
