export default Presences;
/**
 * @extends {Collection<Presence>}
 */
declare class Presences extends Collection<Presence> {
    constructor();
    model: typeof Presence;
    initialize(): void;
    initialized: Promise<any>;
}
import Presence from './presence.js';
import { Collection } from '@converse/skeletor';
//# sourceMappingURL=presences.d.ts.map