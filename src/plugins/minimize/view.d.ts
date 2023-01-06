export default class MinimizedChats {
    initialize(): Promise<void>;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    initToggle(): Promise<void>;
    minchats: any;
    toggle(ev: any): void;
}
