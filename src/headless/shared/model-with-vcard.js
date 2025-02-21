import { getVCardForModel } from "../plugins/vcard/utils.js";
import _converse from "./_converse.js";
import VCard from "../plugins/vcard/vcard.js";

/**
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 */
export default function ModelWithVCard(BaseModel) {
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
            if (this.lazy_load_vcard) {
                this.getVCard(false);
                this.once("visibilityChanged", () => this.getVCard());
            } else {
                this.getVCard();
            }
        }

        get vcard() {
            return this._vcard;
        }

        /**
         * @returns {Promise<VCard|null>}
         */
        async getVCard(create=true) {
            const { pluggable } = _converse;
            if (!pluggable.plugins["converse-vcard"]?.enabled(_converse)) return null;

            if (this._vcard) return this._vcard;

            this._vcard = await getVCardForModel(this, create);
            this.trigger("vcard:add", { vcard: this._vcard });

            return this._vcard;
        }
    };
}
