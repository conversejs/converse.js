declare const CustomElement_base: (new (...args: any[]) => {
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
}) & typeof LitElement;
export class CustomElement extends CustomElement_base {
    createRenderRoot(): this;
    initialize(): any;
    connectedCallback(): any;
}
import { LitElement } from 'lit';
export {};
//# sourceMappingURL=element.d.ts.map