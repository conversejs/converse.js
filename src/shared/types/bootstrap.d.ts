declare module 'bootstrap/js/src/dropdown.js' {
    import { Dropdown } from 'bootstrap';
    export = Dropdown;
}

declare module 'bootstrap/js/src/modal.js' {
    import { Modal } from 'bootstrap';
    export = Modal;
}

declare module 'bootstrap/js/src/popover.js' {
    import { Popover } from 'bootstrap';
    export = Popover;
}

declare module 'bootstrap/js/src/dom/event-handler.js' {
    const EventHandler: {
        on(element: HTMLElement | Document, event: string, handler: (e: Event) => void): void;
        off(element: HTMLElement | Document, event: string, handler?: (e: Event) => void): void;
        trigger(element: HTMLElement | Document, event: string, args?: any): void;
    };
    export = EventHandler;
}
