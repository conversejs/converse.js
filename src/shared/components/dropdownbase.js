import { default as BootstrapDropdown } from "bootstrap/js/src/dropdown.js";
import EventHandler from "bootstrap/js/src/dom/event-handler.js";
import { CustomElement } from "./element.js";

export default class DropdownBase extends CustomElement {
    firstUpdated(changed) {
        super.firstUpdated(changed);
        this.menu = this.querySelector(".dropdown-menu");
        this.button = this.querySelector("button");
        // Use fixed positioning strategy for dropstart menus to prevent
        // clipping by ancestor overflow:hidden containers (e.g. .controlbox-pane)
        const config = this.classList.contains('dropstart')
            ? { popperConfig: { strategy: 'fixed' } }
            : {};
        this.dropdown = new BootstrapDropdown(/** @type {HTMLElement} */ (this.button), config);
    }
}

const DATA_KEY = "bs.dropdown";
const EVENT_KEY = `.${DATA_KEY}`;
const DATA_API_KEY = ".data-api";
const EVENT_KEYDOWN_DATA_API = `keydown${EVENT_KEY}${DATA_API_KEY}`;
EventHandler.off(document, EVENT_KEYDOWN_DATA_API);
