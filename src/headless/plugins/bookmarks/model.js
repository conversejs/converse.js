import { Model } from '@converse/skeletor';
import converse from '../../shared/api/public.js';

const { Strophe } = converse.env;

class Bookmark extends Model {
    get idAttribute() {
        return 'jid';
    }

    /**
     * @returns {boolean}
     */
    get pinned() {
        return this.get('extensions').some(/** @param {String} e */ e => e.includes('<pinned') && e.includes('urn:xmpp:bookmarks-pinning:0'));
    }

    getDisplayName() {
        return this.get('name') && Strophe.xmlunescape(this.get('name')) || this.get('jid');
    }
}

export default Bookmark;
