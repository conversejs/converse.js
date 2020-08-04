import { converse, api } from "@converse/headless/converse-core";

import custom_api from './api';


converse.plugins.add('converse-message-parser', {
    initialize () {
        Object.assign(api, custom_api);
    }
});
