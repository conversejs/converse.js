export type DOMNavigatorOptions = {
    getSelector: Function;
    end?: string[];
    home?: string[];
    down?: number[]; // The keycode for navigating down
    left?: number[]; // The keycode for navigating left
    right?: number[]; // The keycode for navigating right
    up?: number[]; // The keycode for navigating up
    selector?: string;
    selected?: string; // The class that should be added to the currently selected DOM element
    jump_to_picked?: string; // A selector, which if matched by the next
    // element being navigated to, based on the direction
    // given by `jump_to_picked_direction`, will cause navigation
    // to jump to the element that matches the `jump_to_picked_selector`.
    // For example, this is useful when navigating to tabs. You want to
    // immediately navigate to the currently active tab instead of just
    // navigating to the first tab.
    jump_to_picked_selector?: string; // The direction for which jumping to the picked element should be enabled.
    jump_to_picked_direction?: string; // The callback function which should be called when en element gets selected.
    onSelected?: Function;
    scroll_container?: HTMLElement;
};

export type DOMNavigatorDirection = {
    down: string;
    end: string;
    home: string;
    left: string;
    right: string;
    up: string;
};

