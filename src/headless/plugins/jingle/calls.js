import { Collection } from '@converse/skeletor';
import Call from './model.js';

/**
 * A memory-only, ephemeral collection of live {@link Call}s - one per session.
 * @extends {Collection<Call>}
 */
class Calls extends Collection {
    get model() {
        return Call;
    }
}

export default Calls;
