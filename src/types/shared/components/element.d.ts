declare const CustomElement_base: (new (...args: any[]) => {
    on(name: string, callback: (event: any, model: import("@converse/headless").Model, collection: import("@converse/headless").Collection, options?: Record<string, any>) => any, context: any): any;
    _events: any;
    _listeners: {};
    listenTo(obj: any, name: string, callback?: (event: any, model: import("@converse/headless").Model, collection: import("@converse/headless").Collection, options?: Record<string, any>) => any): any;
    _listeningTo: {};
    _listenId: any;
    off(name: string, callback: (event: any, model: import("@converse/headless").Model, collection: import("@converse/headless").Collection, options?: Record<string, any>) => any, context?: any): any;
    stopListening(obj?: any, name?: string, callback?: (event: any, model: import("@converse/headless").Model, collection: import("@converse/headless").Collection, options?: Record<string, any>) => any): any;
    once(name: string, callback: (event: any, model: import("@converse/headless").Model, collection: import("@converse/headless").Collection, options?: Record<string, any>) => any, context: any): any;
    listenToOnce(obj: any, name: string, callback?: (event: any, model: import("@converse/headless").Model, collection: import("@converse/headless").Collection, options?: Record<string, any>) => any): any;
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