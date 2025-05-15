export default Presence;
declare class Presence extends Model {
    defaults(): {
        presence: string;
        show: any;
    };
    initialize(): void;
    resources: Resources;
    onResourcesChanged(): void;
    getStatus(): any;
    /**
     * Return the resource with the highest priority.
     * If multiple resources have the same priority, take the latest one.
     */
    getHighestPriorityResource(): any;
    /**
     * Adds a new resource and it's associated attributes as taken
     * from the passed in presence stanza.
     * Also updates the presence if the resource has higher priority (and is newer).
     * @param {Element} presence: The presence stanza
     */
    addResource(presence: Element): void;
    /**
     * Remove the passed in resource from the resources map.
     * Also redetermines the presence given that there's one less
     * resource.
     * @param {string} name: The resource name
     */
    removeResource(name: string): void;
}
import { Model } from '@converse/skeletor';
import Resources from './resources.js';
//# sourceMappingURL=presence.d.ts.map