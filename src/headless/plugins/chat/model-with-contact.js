import { api, converse } from "../../core.js";
import { Model } from '@converse/skeletor/src/model.js';

const u = converse.env.utils;


const ModelWithContact = Model.extend({

    initialize () {
        this.rosterContactAdded = u.getResolveablePromise();
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
