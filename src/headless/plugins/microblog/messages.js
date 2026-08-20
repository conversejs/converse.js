/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { Collection } from '@converse/skeletor';
import { createStore } from '../../utils/storage.js';
import PubSubMessage from './message.js';

/**
 * A collection of {@link PubSubMessage} posts belonging to one feed (or, when
 * nested under a post, that post's comments).
 *
 * `autoSync` is hydrate-only at the collection level: the collection loads its
 * cached members from storage on construction, while each {@link PubSubMessage}
 * persists itself. Storage is supplied via the `id` construction option so it is
 * available before the constructor's hydration step runs.
 *
 * @extends {Collection<PubSubMessage>}
 */
class PubSubMessages extends Collection {
    get model() {
        return PubSubMessage;
    }

    get autoSync() {
        return true;
    }

    /**
     * @param {PubSubMessage[]} [_models]
     * @param {object} [options]
     * @param {string} [options.id] - Cache key for the backing store.
     */
    initialize(_models, options = {}) {
        // Show the newest posts first.
        this.comparator =
            /**
             * @param {PubSubMessage} a
             * @param {PubSubMessage} b
             */
            (a, b) => (b.get('time') || '').localeCompare(a.get('time') || '');

        if (options.id) {
            this.storage = createStore(options.id);
        }
    }
}

export default PubSubMessages;
