export default class MinimizedChat {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        title: {
            type: StringConstructor;
        };
        type: {
            type: StringConstructor;
        };
        num_unread: {
            type: NumberConstructor;
        };
    };
    render(): import("lit-html").TemplateResult<1>;
    close(ev: any): void;
    restore(ev: any): void;
}
