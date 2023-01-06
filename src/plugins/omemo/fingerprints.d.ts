export class Fingerprints {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    initialize(): Promise<void>;
    devicelist: any;
    render(): "" | import("lit-html").TemplateResult<1>;
    toggleDeviceTrust(ev: any): void;
}
