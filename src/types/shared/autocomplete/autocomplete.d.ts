declare const AutoComplete_base: (new (...args: any[]) => {
    on(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any, context: any): any;
    _events: any;
    _listeners: {};
    listenTo(obj: any, name: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any): any;
    _listeningTo: {};
    _listenId: any;
    off(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any, context?: any): any;
    stopListening(obj?: any, name?: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any): any;
    once(name: string, callback: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any, context: any): any;
    listenToOnce(obj: any, name: string, callback?: (event: any, model: import("@converse/skeletor").Model, collection: import("@converse/skeletor").Collection, options?: Record<string, any>) => any): any;
    trigger(name: string, ...args: any[]): any;
}) & ObjectConstructor;
export class AutoComplete extends AutoComplete_base {
    /**
     * @param {HTMLElement} el
     * @param {any} config
     */
    constructor(el: HTMLElement, config?: any);
    suggestions: any[];
    is_opened: boolean;
    auto_evaluate: boolean;
    match_current_word: boolean;
    sort: ((a: any, b: any) => number) | null;
    filter: (text: any, input: any) => boolean;
    ac_triggers: any[];
    include_triggers: any[];
    min_chars: number;
    max_items: number;
    auto_first: boolean;
    data: (a: any, _v: any) => any;
    item: (text: any, input: any) => HTMLLIElement;
    container: Element | HTMLElement | null;
    input: HTMLInputElement;
    ul: Element | null;
    status: Element | null;
    index: number;
    set list(list: any);
    get list(): any;
    bindEvents(): void;
    _list: any;
    get selected(): boolean;
    get opened(): boolean;
    close(o: any): void;
    insertValue(suggestion: any): void;
    open(): void;
    destroy(): void;
    next(): void;
    previous(): void;
    /**
     * @param {number} i
     * @param {boolean} scroll=true
     */
    goto(i: number, scroll?: boolean): void;
    select(selected: any): void;
    auto_completing: boolean | undefined;
    onMouseOver(ev: any): void;
    onMouseDown(ev: any): void;
    onKeyDown(ev: any): true | undefined;
    /**
     * @param {KeyboardEvent} [ev]
     */
    evaluate(ev?: KeyboardEvent | undefined): Promise<void>;
}
export default AutoComplete;
//# sourceMappingURL=autocomplete.d.ts.map