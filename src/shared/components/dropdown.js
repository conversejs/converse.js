/**
 * @typedef {module:dom-navigator.DOMNavigatorOptions} DOMNavigatorOptions
 */
import { html } from "lit";
import { until } from "lit/directives/until.js";
import { api, constants, u } from "@converse/headless";
import { DOMNavigator } from "shared/dom-navigator";
import DropdownBase from "shared/components/dropdownbase.js";
import "shared/components/icons.js";
import { __ } from "i18n";

import "./styles/dropdown.scss";

const { KEYCODES } = constants;

export default class Dropdown extends DropdownBase {
    static get properties() {
        return {
            icon_classes: { type: String },
            items: { type: Array },
        };
    }

    constructor() {
        super();
        this.icon_classes = "fa fa-bars";
        this.items = [];
        this.id = u.getUniqueId();
    }

    render() {
        return html`
            <button class="btn btn--transparent btn--standalone dropdown-toggle dropdown-toggle--no-caret"
                    id="${this.id}"
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-haspopup="true"
                    aria-expanded="false"
                    aria-label=${__("Menu")}>
                <converse-icon aria-hidden="true" size="1em" class="${this.icon_classes}">
            </button>
            <ul class="dropdown-menu" aria-labelledby="${this.id}">
                ${this.items.map((b) => html`<li>${until(b, "")}</li>`)}
            </ul>
        `;
    }

    firstUpdated() {
        super.firstUpdated();
        this.initArrowNavigation();
    }

    connectedCallback() {
        super.connectedCallback();
        this.registerEvents();
    }

    disconnectedCallback() {
        this.removeEventListener("keydown", this.onGlobalKeyDown);
        this.disableArrowNavigation();
        super.disconnectedCallback();
    }

    registerEvents() {
        this.onGlobalKeyDown = (ev) => this.#onGlobalKeyDown(ev);
        this.addEventListener("hide.bs.dropdown", () => this.onDropdownHide());
        this.addEventListener("keydown", this.onGlobalKeyDown);
    }

    onDropdownHide() {
        this.disableArrowNavigation();
    }

    initArrowNavigation() {
        if (!this.navigator) {
            const options = /** @type DOMNavigatorOptions */ ({
                selector: ".dropdown-menu li",
                onSelected: (el) => el.focus(),
            });
            this.navigator = new DOMNavigator(/** @type HTMLElement */ (this.menu), options);
        }
    }

    disableArrowNavigation() {
        this.navigator?.disable();
    }

    /**
     * @param {KeyboardEvent} [ev]
     */
    enableArrowNavigation(ev) {
        ev?.preventDefault();
        ev?.stopPropagation();
        this.disableArrowNavigation();
        this.navigator.enable();
        this.navigator.select(/** @type HTMLElement */ (this.menu.firstElementChild));
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onEnterPressed(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.navigator.selected?.querySelector('a')?.click();
        this.dropdown.hide();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    #onGlobalKeyDown(ev) {
        if (!this.navigator || !u.isVisible(this)) return;

        if (ev.key === KEYCODES.ENTER) {
            this.onEnterPressed(ev);
        } else if (ev.key === KEYCODES.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        } else if (ev.key === KEYCODES.ESCAPE) {
            this.dropdown.hide();
        }
    }
}

api.elements.define("converse-dropdown", Dropdown);
