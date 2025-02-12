export default DiscoEntity;
/**
 * @class
 * @namespace _converse.DiscoEntity
 * @memberOf _converse
 *
 * A Disco Entity is a JID addressable entity that can be queried for features.
 *
 * See XEP-0030: https://xmpp.org/extensions/xep-0030.html
 */
declare class DiscoEntity extends Model {
    initialize(_: any, options: any): void;
    waitUntilFeaturesDiscovered: any;
    waitUntilItemsFetched: any;
    dataforms: Collection;
    features: Collection;
    fields: Collection;
    identities: Collection;
    /**
     * Returns a Promise which resolves with a map indicating
     * whether a given identity is provided by this entity.
     * @method _converse.DiscoEntity#getIdentity
     * @param { String } category - The identity category
     * @param { String } type - The identity type
     */
    getIdentity(category: string, type: string): Promise<any>;
    /**
     * Returns a Promise which resolves with a map indicating
     * whether a given feature is supported.
     * @method _converse.DiscoEntity#getFeature
     * @param { String } feature - The feature that might be supported.
     */
    getFeature(feature: string): Promise<this>;
    onFeatureAdded(feature: any): void;
    onFieldAdded(field: any): void;
    fetchFeatures(options: any): Promise<void>;
    queryInfo(): Promise<void>;
    /**
     * @param {Element} stanza
     */
    onDiscoItems(stanza: Element): void;
    queryForItems(): Promise<void>;
    /**
     * @param {Element} stanza
     */
    onInfo(stanza: Element): Promise<void>;
}
import { Model } from '@converse/skeletor';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=entity.d.ts.map