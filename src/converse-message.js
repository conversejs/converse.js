import { converse, api } from "@converse/headless/converse-core";
import log from "@converse/headless/log";


converse.plugins.add('converse-message', {
    initialize () {
        api.message = {
            _filters: [],
            getFilters () {
                return this._filters;
            },
            setFilters (args) {
                if (Array.isArray(args)) {
                    this._filters.push(args);
                } else if (typeof args === 'function') {
                    this._filters.push(...arguments);
                } else {
                    log.error('api.addFilters function requires a function or array of functions as first parameter');
                }
            }
        }
    }
});
