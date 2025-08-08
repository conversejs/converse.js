export class Fingerprints extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    initialize(): Promise<void>;
    devicelist: any;
    render(): import("lit-html").TemplateResult<1> | "";
    /**
        * @param {Event} ev
        */
    toggleDeviceTrust(ev: Event): void;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=fingerprints.d.ts.map