declare const AutoComplete_base: (new (...args: any[]) => {
    [x: string]: any;
    _events?: import("@converse/skeletor").EventHandlersMap;
    _listeners?: import("@converse/skeletor").EventListenerMap;
    _listeningTo?: import("@converse/skeletor").EventListenerMap;
    _listenId?: string;
    on(name: string | import("@converse/skeletor").EventCallbackMap, callback?: import("@converse/skeletor").EventCallback | import("@converse/skeletor").EventContext, context?: import("@converse/skeletor").EventContext): any;
    listenTo(obj: import("@converse/skeletor").ObjectListenedTo, name: string | import("@converse/skeletor").EventCallbackMap, callback?: import("@converse/skeletor").EventCallback): any;
    off(name?: string | import("@converse/skeletor").EventCallbackMap | null, callback?: import("@converse/skeletor").EventCallback | import("@converse/skeletor").EventContext | null, context?: import("@converse/skeletor").EventContext): any;
    stopListening(obj?: any, name?: string | import("@converse/skeletor").EventCallbackMap, callback?: import("@converse/skeletor").EventCallback): any;
    once(name: string | import("@converse/skeletor").EventCallbackMap, callback?: import("@converse/skeletor").EventCallback | import("@converse/skeletor").EventContext, context?: import("@converse/skeletor").EventContext): any;
    listenToOnce(obj: any, name: string | import("@converse/skeletor").EventCallbackMap, callback?: import("@converse/skeletor").EventCallback): any;
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
    match_current_word: boolean;
    sort: (a: any, b: any) => number;
    filter: typeof FILTER_CONTAINS;
    ac_triggers: any[];
    include_triggers: any[];
    min_chars: number;
    max_items: number;
    auto_first: boolean;
    data: (a: any, _v: any) => any;
    item: typeof getAutoCompleteItem;
    container: Element | HTMLElement;
    input: HTMLInputElement;
    ul: HTMLElement;
    status: Element;
    index: number;
    set list(list: any);
    get list(): any;
    bindEvents(): void;
    _list: any;
    get selected(): boolean;
    get opened(): boolean;
    /**
     * @param {import('./types').closeParam} o
     */
    close(o: import("./types").closeParam): void;
    /**
     * @param {Suggestion} suggestion
     */
    insertValue(suggestion: Suggestion): void;
    open(): void;
    destroy(): void;
    next(): void;
    previous(): void;
    /**
     * @param {number} i
     * @param {boolean} scroll=true
     */
    goto(i: number, scroll?: boolean): void;
    /**
     * @param {Element} [selected]
     */
    select(selected?: Element): void;
    auto_completing: boolean;
    /**
     * @param {Event} ev
     */
    onMouseOver(ev: Event): void;
    /**
     * @param {MouseEvent} ev
     */
    onMouseDown(ev: MouseEvent): void;
    /**
     * @param {KeyboardEvent} [ev]
     */
    onKeyDown(ev?: KeyboardEvent): boolean;
    /**
     * @param {KeyboardEvent} [ev]
     */
    evaluate(ev?: KeyboardEvent): Promise<void>;
}
export default AutoComplete;
import { FILTER_CONTAINS } from './utils.js';
import { getAutoCompleteItem } from './utils.js';
import Suggestion from './suggestion.js';
//# sourceMappingURL=autocomplete.d.ts.map