export default VCard;
declare class VCard extends Model<import("@converse/skeletor").ModelAttributes> {
    /**
     * @param {import("../../shared/types").ModelAttributes} attrs
     * @param {import("./types").VCardModelOptions} options
     */
    constructor(attrs: import("../../shared/types").ModelAttributes, options: import("./types").VCardModelOptions);
    _vcard: any;
    /**
     * @param {import("../../shared/types").ModelAttributes} [_attrs]
     * @param {import("./types").VCardModelOptions} [options]
     */
    initialize(_attrs?: import("../../shared/types").ModelAttributes, options?: import("./types").VCardModelOptions): void;
    lazy_load: boolean;
    /**
     * Helper method that returns the user's nickname given that there's more
     * than on esource.
     *
     * `pep_nickname` (XEP-0172 User Nickname, pushed over PEP) wins over the
     * vcard-temp `NICKNAME`/`FN`.
     * @returns {string|undefined}
     */
    getNickname(): string | undefined;
    /**
     * The best human-readable name resolvable for this JID from its identity
     * sources, or undefined if none is known.
     * @returns {string|undefined}
     */
    getName(): string | undefined;
    getDisplayName(): any;
}
import { Model } from '@converse/skeletor';
//# sourceMappingURL=vcard.d.ts.map