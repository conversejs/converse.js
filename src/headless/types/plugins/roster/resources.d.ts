export default Resources;
/**
 * @extends {Collection<Resource>}
 */
declare class Resources extends Collection<Resource> {
    constructor(models?: import("@converse/skeletor").ModelAttributes | import("@converse/skeletor").ModelAttributes[] | Resource | Resource[], options?: import("@converse/skeletor").CollectionOptions<Resource>);
    /**
     * @param {Resource[]} _models
     * @param {{ jid: string }} [options]
     */
    initialize(_models: Resource[], options?: {
        jid: string;
    }): void;
}
import Resource from './resource.js';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=resources.d.ts.map