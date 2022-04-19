import { Model } from '@converse/skeletor/src/model.js';

export const RosterFilter = Model.extend({
    initialize () {
        this.set({
            'filter_text': '',
            'filter_type': 'contacts',
            'chat_state': 'online'
        });
    }
});
