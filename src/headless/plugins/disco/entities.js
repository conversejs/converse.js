import DiscoEntity from './entity.js';
import log from "@converse/log";
import { Collection } from "@converse/skeletor";

/**
 * @extends {Collection<DiscoEntity>}
 */
class DiscoEntities extends Collection {

    constructor () {
        super();
        this.model = DiscoEntity;
    }

    fetchEntities () {
        return new Promise((resolve, reject) => {
            this.fetch({
                add: true,
                success: resolve,
                error (_m, e) {
                    log.error(e);
                    reject (new Error("Could not fetch disco entities"));
                }
            });
        });
    }
}

export default DiscoEntities;
