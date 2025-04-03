export default class MessageBody extends CustomElement {
    static get properties(): {
        hide_url_previews: {
            type: StringConstructor;
        };
        is_me_message: {
            type: BooleanConstructor;
        };
        model: {
            type: ObjectConstructor;
        };
        text: {
            type: StringConstructor;
        };
    };
    text: any;
    model: any;
    hide_url_previews: any;
    initialize(): void;
    onImgClick(ev: any): void;
    onImgLoad(): void;
    render(): import("lit-html/directive").DirectiveResult<{
        new (_partInfo: import("lit-html/directive").PartInfo): {
            render(text: string, offset: number, options: object, callback?: Function): import("lit-html").TemplateResult<1>;
            readonly _$isConnected: boolean;
            update(_part: import("lit-html").Part, props: Array<unknown>): unknown;
        };
    }>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=message-body.d.ts.map