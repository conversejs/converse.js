/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { html } from 'lit';
import { api, constants, log, u } from '@converse/headless';
import DropdownBase from 'shared/components/dropdownbase.js';
import 'shared/components/icons.js';
import { __ } from 'i18n';

import 'shared/components/styles/dropdown.scss';
import './styles/attachment-menu.scss';

const { CHATROOMS_TYPE, KEYCODES } = constants;

// Where an item without a numeric `order` goes: after every numbered one. Not
// `Infinity`, since the sort comparator subtracts, and `Infinity - Infinity`
// is `NaN`.
const DEFAULT_ORDER = Number.MAX_SAFE_INTEGER;

/**
 * The attachment button (a paperclip) in a chat's toolbar, and the attachment
 * menu it opens: one labelled row for each thing the user can attach.
 *
 * Plugins add items through the `getAttachmentMenuItems` hook, which runs once
 * when the menu is initialized. A handler may await a disco query, so that an
 * item appears once the server feature it needs is confirmed, and it may leave
 * its item out of chats where it doesn't apply. Without any items there is no
 * paperclip.
 */
export default class AttachmentMenu extends DropdownBase {
    static properties = {
        model: { type: Object },
        items: { state: true },
    };

    // Set while an item's activation closes the menu, so that focus is left to
    // whatever the item opens instead of being handed back to the paperclip.
    #activating = false;

    // The paperclip's `id`, through which the menu is labelled. Not set on the
    // host element too: a shared id resolves to the host, and the menu would
    // be named after everything in it.
    #button_id = u.getUniqueId();

    constructor() {
        super();
        this.model = null;
        /** @type {import('./types').AttachmentMenuItem[]} */
        this.items = [];
    }

    registerEvents() {
        this._onKeyDown = /** @param {KeyboardEvent} ev */ (ev) => this.#onKeyDown(ev);
        this._onShow = () => this.#focusItem(0);
        this._onHide = () => this.#onHide();
        this.addEventListener('keydown', this._onKeyDown);
        this.addEventListener('converse:dropdown:show', this._onShow);
        this.addEventListener('converse:dropdown:hide', this._onHide);
    }

    unregisterEvents() {
        this.removeEventListener('keydown', this._onKeyDown);
        this.removeEventListener('converse:dropdown:show', this._onShow);
        this.removeEventListener('converse:dropdown:hide', this._onHide);
    }

    initialize() {
        /**
         * Resolves once the hook has run and `items` is set, so that the
         * paperclip is drawn, or known to be absent.
         * @type {Promise<void>}
         */
        this.initialized = this.#initialize();
        return this.initialized;
    }

    async #initialize() {
        await this.model.initialized;
        this.items = await this.#getItems();
    }

    /**
     * @returns {Promise<import('./types').AttachmentMenuItem[]>}
     */
    async #getItems() {
        let items;
        try {
            /**
             * *Hook* which allows plugins to add items to a chat's attachment menu.
             * Handlers receive the menu element, which exposes the chat `model`,
             * and the items so far, and must return the list. A handler may
             * await a disco query before pushing its item.
             * @event _converse#getAttachmentMenuItems
             * @example
             *  api.listen.on('getAttachmentMenuItems', (menu, items) => {
             *      items.push({
             *          name: 'contact',
             *          order: 500,
             *          icon: 'fa-user',
             *          label: __('Share a contact'),
             *          handler: () => shareContact(menu.model),
             *      });
             *      return items;
             *  });
             */
            items = await api.hook('getAttachmentMenuItems', this, []);
        } catch (e) {
            log.error(e);
        }
        // Each handler gets what the previous one returned, so one that throws
        // or doesn't return the list leaves nothing to show.
        if (!Array.isArray(items)) {
            log.error(
                'getAttachmentMenuItems: a handler threw or did not return the list of items, so there is no attachment menu',
            );
            return [];
        }
        const orderOf = (/** @type {import('./types').AttachmentMenuItem} */ item) =>
            Number.isFinite(item.order) ? item.order : DEFAULT_ORDER;
        return [...items].sort((a, b) => orderOf(a) - orderOf(b));
    }

    render() {
        if (!this.items.length) return '';

        const color = this.model.get('type') === CHATROOMS_TYPE ? '--muc-color' : '--chat-color';
        const i18n_add_attachment = __('Add attachment');
        return html`<button
                class="btn dropdown-toggle dropdown-toggle--no-caret toggle-attachment-menu"
                type="button"
                id="${this.#button_id}"
                title="${i18n_add_attachment}"
                aria-label="${i18n_add_attachment}"
                aria-haspopup="menu"
                aria-expanded="false"
            >
                <converse-icon color="var(${color})" class="fa fa-paperclip" size="1em"></converse-icon>
            </button>
            <ul class="dropdown-menu attachment-menu" role="menu" aria-labelledby="${this.#button_id}">
                ${this.items.map(
                    (item) => html`<li role="none">
                        <button
                            type="button"
                            class="dropdown-item attachment-menu__item"
                            role="menuitem"
                            data-name="${item.name}"
                            @mousemove=${(/** @type {MouseEvent} */ ev) => this.#onItemHover(ev)}
                            @click=${(/** @type {MouseEvent} */ ev) => this.#activate(ev, item)}
                        >
                            <converse-icon color="var(${color})" class="fa ${item.icon}" size="1em"></converse-icon>
                            <span>${item.label}</span>
                        </button>
                    </li>`,
                )}
            </ul>
            <input type="file" class="fileupload" multiple hidden @change=${this.#onFileSelection} />`;
    }

    firstUpdated() {
        // The base class would find the button and the menu here, but neither
        // is drawn until the hook has run. They're picked up in `updated`.
    }

    /**
     * @param {import('lit').PropertyValues} changed
     */
    updated(changed) {
        if (!this.button && this.items.length) super.firstUpdated(changed);
    }

    /**
     * Move focus to the item under the pointer, so that the one highlight
     * follows the mouse rather than staying on the item that was focused on open.
     * @param {MouseEvent} ev
     */
    #onItemHover(ev) {
        /** @type {HTMLElement} */ (ev.currentTarget).focus();
    }

    /**
     * Close the menu, then run the item's handler, so that whatever the
     * handler opens (a file picker, a dialog, a panel) is what the user sees
     * next, and nothing in the menu claims focus afterwards.
     * @param {Event} ev
     * @param {import('./types').AttachmentMenuItem} item
     */
    #activate(ev, item) {
        ev.preventDefault();
        ev.stopPropagation();
        this.#activating = true;
        this.hide();
        this.#activating = false;
        item.handler();
    }

    /**
     * The menu was closed by Escape, a click outside or Tab: if focus was in
     * the menu, hand it back to the paperclip, so that a keyboard user knows
     * where they are. Focus elsewhere, such as in the message field, is left
     * alone.
     */
    #onHide() {
        if (!this.#activating && this.contains(document.activeElement)) this.button?.focus();
    }

    /**
     * Up and down move between the items, wrapping around; Home and End jump to
     * the ends; Tab leaves the menu, so closes it. Enter and Space are the
     * buttons' own activation, and Escape is handled for every dropdown.
     * @param {KeyboardEvent} ev
     */
    #onKeyDown(ev) {
        if (!this.menu?.classList.contains('show')) return;

        const index = this.#getItemElements().indexOf(/** @type {HTMLElement} */ (document.activeElement));
        if (ev.key === KEYCODES.DOWN_ARROW) {
            ev.preventDefault();
            this.#focusItem(index + 1);
        } else if (ev.key === KEYCODES.UP_ARROW) {
            ev.preventDefault();
            this.#focusItem(index - 1);
        } else if (ev.key === 'Home') {
            ev.preventDefault();
            this.#focusItem(0);
        } else if (ev.key === 'End') {
            ev.preventDefault();
            this.#focusItem(-1);
        } else if (ev.key === KEYCODES.TAB) {
            this.hide();
        }
    }

    /**
     * @returns {HTMLElement[]}
     */
    #getItemElements() {
        return Array.from(this.querySelectorAll('.attachment-menu__item'));
    }

    /**
     * @param {number} index - Counted from the end when negative, and wrapping around.
     */
    #focusItem(index) {
        const items = this.#getItemElements();
        if (!items.length) return;
        items[((index % items.length) + items.length) % items.length].focus();
    }

    /**
     * Open the browser's file picker and send what the user chooses through
     * the chat's file-sending path, so that OMEMO encryption, size limits and
     * the upload progress message all apply. For an item to call from its
     * handler.
     * @param {Object} [options]
     * @param {string} [options.accept] - The accepted file types, as for the
     *  `accept` attribute of a file input, for example `image/*`. Any file by
     *  default. On a phone, accepting only images opens the photo gallery.
     */
    pickFiles({ accept = '' } = {}) {
        const input = /** @type {HTMLInputElement} */ (this.querySelector('input.fileupload'));
        input.accept = accept;
        input.click();
    }

    /** @param {Event} ev */
    #onFileSelection(ev) {
        const input = /** @type {HTMLInputElement} */ (ev.target);
        const files = Array.from(input.files);
        // Cleared so that choosing the same file again counts as a new selection.
        input.value = '';
        this.model.sendFiles(files);
    }
}

api.elements.define('converse-attachment-menu', AttachmentMenu);
