import { getVCardForModel } from "../plugins/vcard/utils.js";
import _converse from "./_converse.js";

/**
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 */
export default function ModelWithVCard(BaseModel) {
    /**
     * @typedef {import('../plugins/vcard/vcard').default} VCard
     */

    return class ModelWithVCard extends BaseModel {
        /**
         * @param {any[]} args
         */
        constructor(...args) {
            super(...args);
            this._vcard = null;
            this.lazy_load_vcard = false;
        }

        initialize() {
            super.initialize();
            this.getVCard();
        }

        get vcard() {
            return this._vcard;
        }

        /**
         * @returns {Promise<VCard|null>}
         */
        async getVCard() {
            const { pluggable } = _converse;
            if (!pluggable.plugins["converse-vcard"]?.enabled(_converse)) return null;

            if (this._vcard) return this._vcard;

            this._vcard = await getVCardForModel(this, this.lazy_load_vcard);
            this.trigger("vcard:add", { vcard: this._vcard });

            return this._vcard;
        }
    };
}
