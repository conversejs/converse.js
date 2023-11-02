import { converse } from '../../shared/api/index.js';
import { Model } from '@converse/skeletor';

const { Strophe } = converse.env;

class Bookmark extends Model {
    get idAttribute () { // eslint-disable-line class-methods-use-this
        return 'jid';
    }

    getDisplayName () {
        return Strophe.xmlunescape(this.get('name'));
    }
}

export default Bookmark;
