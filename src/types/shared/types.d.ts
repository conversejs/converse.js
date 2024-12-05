export type DOMNavigatorOptions = {
    getSelector: Function;
    end?: string[];
    home?: string[];
    down?: number[];
    left?: number[];
    right?: number[];
    up?: number[];
    selector?: string;
    selected?: string;
    jump_to_picked?: string;
    jump_to_picked_selector?: string;
    jump_to_picked_direction?: string;
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
//# sourceMappingURL=types.d.ts.map