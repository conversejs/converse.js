import { Model } from '@converse/skeletor/src/model.js';
import { api } from "../../core.js";
import { getOpenPromise } from '@converse/openpromise';

const ModelWithContact = Model.extend({

    initialize () {
        this.rosterContactAdded = getOpenPromise();
    },

    async setRosterContact (jid) {
        const contact = await api.contacts.get(jid);
        if (contact) {
            this.contact = contact;
            this.set('nickname', contact.get('nickname'));
            this.rosterContactAdded.resolve();
        }
    }
});

export default ModelWithContact;
