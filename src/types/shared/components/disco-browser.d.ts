export class DiscoBrowser extends CustomElement {
    static get properties(): {
        _entity_jid: {
            type: StringConstructor;
            state: boolean;
        };
    };
    _entity_jid: any;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {import('@converse/headless/types/plugins/disco/entity').default} i
     */
    renderItem(i: import("@converse/headless/types/plugins/disco/entity").default): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     * @param {import('@converse/headless/types/plugins/disco/entity').default} identity
     */
    setEntityJID(ev: MouseEvent, identity: import("@converse/headless/types/plugins/disco/entity").default): void;
    getDiscoInfo(): Promise<{
        features: any;
        identities: any;
        items: any[];
    }>;
}
import { CustomElement } from './element';
//# sourceMappingURL=disco-browser.d.ts.map