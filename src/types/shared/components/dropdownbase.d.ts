export default class DropdownBase extends CustomElement {
    menu: HTMLElement;
    button: HTMLButtonElement;
    /** @param {MouseEvent} ev */
    _onButtonClick: (ev: MouseEvent) => void;
    connectedCallback(): void;
    /**
     * Override in subclass to register event listeners.
     * Called automatically from connectedCallback().
     */
    registerEvents(): void;
    /**
     * Override in subclass to unregister event listeners.
     * Called automatically from disconnectedCallback().
     */
    unregisterEvents(): void;
    /** Toggle the dropdown's visibility */
    toggle(): void;
    /** Show the dropdown */
    show(): void;
    _popper: import("@popperjs/core").Instance;
    _onDocumentClick: (ev: any) => void;
    /** Hide the dropdown */
    hide(): void;
}
import { CustomElement } from './element.js';
//# sourceMappingURL=dropdownbase.d.ts.map