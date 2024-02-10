import { Model } from '@converse/skeletor';

class RosterFilter extends Model {
    initialize () {
        super.initialize();
        this.set({
            'filter_text': '',
            'filter_type': 'contacts',
            'chat_state': 'online'
        });
    }
}

export { RosterFilter };
