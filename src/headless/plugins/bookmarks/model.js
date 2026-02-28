import { Model } from '@converse/skeletor';
import converse from '../../shared/api/public.js';

const { Strophe } = converse.env;

class Bookmark extends Model {
    initialize() {
        super.initialize();
        this.attributes.pinned = this.get('extensions')?.some(/** @param {String} e */ e => e.includes('<pinned') && e.includes(Strophe.NS.BOOKMARKS_PINNING)) || false;
    }

    get idAttribute() {
        return 'jid';
    }

    getDisplayName() {
        return this.get('name') && Strophe.xmlunescape(this.get('name')) || this.get('jid');
    }
}

export default Bookmark;
