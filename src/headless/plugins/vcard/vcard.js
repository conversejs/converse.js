import { Model } from "@converse/skeletor";
import _converse from "../../shared/_converse";
import api from "../../shared/api/index";

class VCard extends Model {
    /**
     * @param {import("../../shared/types").ModelAttributes} attrs
     * @param {import("./types").VCardModelOptions} options
     */
    constructor(attrs, options) {
        super(attrs, options);
        this._vcard = null;
    }

    /**
     * @param {import("../../shared/types").ModelAttributes} [_attrs]
     * @param {import("./types").VCardModelOptions} [options]
     */
    initialize(_attrs, options) {
        this.lazy_load = api.settings.get('lazy_load_vcards') && !!options?.lazy_load;

        if (this.lazy_load) {
            this.once("visibilityChanged", () => api.vcard.update(this));
        } else {
            api.vcard.update(this);
        }
    }

    get idAttribute() {
        return "jid";
    }

    getDisplayName() {
        return this.get("nickname") || this.get("fullname") || this.get("jid");
    }
}

export default VCard;
