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
    render(): import("lit/directive").DirectiveResult<{
        new (_partInfo: import("lit/directive").PartInfo): {
            render(text: string, offset: number, options: object, callback?: Function | undefined): import("lit").TemplateResult<1>;
            readonly _$isConnected: boolean;
            update(_part: import("lit").Part, props: Array<unknown>): unknown;
        };
    }>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=message-body.d.ts.map