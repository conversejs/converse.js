export default class MessageUnfurl extends CustomElement {
    static get properties(): {
        description: {
            type: StringConstructor;
        };
        image: {
            type: StringConstructor;
        };
        jid: {
            type: StringConstructor;
        };
        title: {
            type: StringConstructor;
        };
        url: {
            type: StringConstructor;
        };
    };
    jid: any;
    url: any;
    title: any;
    image: any;
    description: any;
    initialize(): void;
    render(): "" | import("lit").TemplateResult<1>;
    onImageLoad(): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=unfurl.d.ts.map