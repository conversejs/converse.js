import { Model } from '@converse/skeletor';
import api from '../../shared/api/index.js';

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
     * @param {import("../../shared/types.ts").ModelAttributes} [_attrs]
     * @param {import("./types.ts").VCardModelOptions} [options]
     */
    initialize(_attrs, options) {
        // A vcard rehydrated from cache (`fromStorage`) already represents a known
        // entity, so it must not eagerly refetch on every page load.
        const lazy = !!options?.lazy_load || !!options?.fromStorage;
        this.lazy_load = api.settings.get('lazy_load_vcards') && lazy;

        if (this.lazy_load) {
            this.once('visibilityChanged', () => api.vcard.update(this));
        } else {
            api.vcard.update(this);
        }
    }

    get idAttribute() {
        return 'jid';
    }

    /**
     * Helper method that returns the user's nickname given that there's more
     * than on esource.
     *
     * `pep_nickname` (XEP-0172 User Nickname, pushed over PEP) wins over the
     * vcard-temp `NICKNAME`/`FN`.
     * @returns {string|undefined}
     */
    getNickname() {
        return this.get('pep_nickname') || this.get('nickname') || undefined;
    }

    /**
     * The best human-readable name resolvable for this JID from its identity
     * sources, or undefined if none is known.
     * @returns {string|undefined}
     */
    getName() {
        return this.getNickname() || this.get('fullname') || undefined;
    }

    getDisplayName() {
        return this.getName() || this.get('jid');
    }
}

export default VCard;
