export class LocationButton extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        is_groupchat: {
            type: BooleanConstructor;
        };
        fetching_location: {
            type: BooleanConstructor;
            state: boolean;
        };
    };
    model: any;
    is_groupchat: boolean;
    fetching_location: boolean;
    render(): import("lit-html").TemplateResult<1>;
    /** @param {MouseEvent} ev */
    shareLocation(ev: MouseEvent): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=location-button.d.ts.map