export default Presence;
/**
 * @extends {Model<import('./types').PresenceAttrs>}
 */
declare class Presence extends Model<import("./types").PresenceAttrs> {
    constructor(attributes?: Partial<import("./types").PresenceAttrs>, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        presence: import("./types").PresenceTypes | "offline";
    };
    initialize(): void;
    resources: Resources;
    onResourcesChanged(): void;
    getStatus(): string;
    /**
     * Return the resource with the highest priority.
     * If multiple resources have the same priority, take the latest one.
     */
    getHighestPriorityResource(): import("./resource.js").default;
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