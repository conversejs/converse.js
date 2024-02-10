import { Model } from '@converse/skeletor';

class RosterFilter extends Model {
    initialize () {
        super.initialize();
        this.set({
            text: '',
            type: 'items',
            state: 'online'
        });
    }
}

export { RosterFilter };
