import { Model } from '@converse/skeletor';
import converse from '../../shared/api/public.js';

const { Strophe } = converse.env;

class Bookmark extends Model {
    get idAttribute () {
        return 'jid';
    }

    getDisplayName () {
        return Strophe.xmlunescape(this.get('name')) || this.get('jid');
    }
}

export default Bookmark;
