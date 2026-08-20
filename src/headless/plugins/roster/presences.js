import { Collection } from '@converse/skeletor';
import _converse from '../../shared/_converse.js';
import { initStorage } from '../../utils/storage.js';
import Presence from './presence.js';

/**
 * @extends {Collection<Presence>}
 */
class Presences extends Collection {
    constructor() {
        super();
        this.model = Presence;
    }

    initialize() {
        super.initialize();

        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.presences-${bare_jid}`;
        initStorage(this, id, 'session');

        // We might be continuing an existing session, so we fetch cached presence data.
        this.initialized = new Promise((r) => this.fetch({ success: r, error: r }));
    }
}

export default Presences;
