export class Fingerprints extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    initialize(): Promise<void>;
    devicelist: any;
    render(): import("lit").TemplateResult<1> | "";
    toggleDeviceTrust(ev: any): void;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=fingerprints.d.ts.map