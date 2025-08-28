export default DiscoBrowser;
declare class DiscoBrowser extends CustomElement {
    static get properties(): {
        _entity_jids: {
            type: ArrayConstructor;
            state: boolean;
        };
    };
    _entity_jids: any[];
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     * @param {number} index
     */
    handleBreadcrumbClick(ev: MouseEvent, index: number): void;
    /**
     * @param {SubmitEvent} ev
     */
    queryEntity(ev: SubmitEvent): void;
    /**
     * @param {import('@converse/headless/types/plugins/disco/entity').default} i
     */
    renderItem(i: import("@converse/headless/types/plugins/disco/entity").default): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     * @param {import('@converse/headless/types/plugins/disco/entity').default} identity
     */
    addEntityJID(ev: MouseEvent, identity: import("@converse/headless/types/plugins/disco/entity").default): void;
    getDiscoInfo(): Promise<{
        error: any;
        features?: undefined;
        identities?: undefined;
        items?: undefined;
    } | {
        features: any;
        identities: any;
        items: any;
        error?: undefined;
    }>;
}
import { CustomElement } from 'shared/components/element';
//# sourceMappingURL=disco-browser.d.ts.map