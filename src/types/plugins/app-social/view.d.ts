export default SocialApp;
declare class SocialApp extends CustomElement {
    static get properties(): {
        open_post: {
            type: ObjectConstructor;
            state: boolean;
        };
        open_profile: {
            type: StringConstructor;
            state: boolean;
        };
    };
    open_post: any;
    open_profile: any;
    render(): import("lit-html").TemplateResult<1>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=view.d.ts.map