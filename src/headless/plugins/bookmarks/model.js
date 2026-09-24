import { Model } from '@converse/skeletor';
import converse from '../../shared/api/public.js';
import { isPinnedExtension } from './utils.js';

const { Strophe } = converse.env;

class Bookmark extends Model {
    initialize() {
        super.initialize();
        // `pinned` (XEP-0469) is a local projection of the `<pinned/>` element
        // in `extensions`, which is the single source of truth. Keep it in sync
        // whenever the extensions change.
        this.on('change:extensions', () => this.updatePinnedState());
        this.updatePinnedState();
    }

    get idAttribute() {
        return 'jid';
    }

    updatePinnedState() {
        this.set('pinned', this.get('extensions')?.some(isPinnedExtension) || false);
    }

    getDisplayName() {
        return this.get('name') && Strophe.xmlunescape(this.get('name')) || this.get('jid');
    }
}

export default Bookmark;
