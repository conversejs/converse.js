import api from "../../shared/api/index.js";
import { Model } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';

class ModelWithContact extends Model {
    /**
     * @typedef {import('../vcard/vcard').default} VCard
     * @typedef {import('../roster/contact').default} RosterContact
     */

    initialize () {
        super.initialize();
        this.rosterContactAdded = getOpenPromise();
        /**
         * @public
         * @type {RosterContact}
         */

        this.contact = null;
        /**
         * @public
         * @type {VCard}
         */
        this.vcard = null;
    }

    /**
     * @param {string} jid
     */
    async setRosterContact (jid) {
        const contact = await api.contacts.get(jid);
        if (contact) {
            this.contact = contact;
            this.set('nickname', contact.get('nickname'));
            this.rosterContactAdded.resolve();
        }
    }
}

export default ModelWithContact;
