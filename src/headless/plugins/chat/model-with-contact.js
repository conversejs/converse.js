import api from "../../shared/api/index.js";
import { Model } from '@converse/skeletor';
import { getOpenPromise } from '@converse/openpromise';

class ModelWithContact extends Model {

    initialize () {
        super.initialize();
        this.rosterContactAdded = getOpenPromise();
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
