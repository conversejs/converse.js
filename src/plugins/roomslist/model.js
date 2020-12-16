import { _converse } from "@converse/headless/core";
import { Model } from '@converse/skeletor/src/model.js';


export default Model.extend({
    defaults: {
        "toggle-state":  _converse.OPENED
    }
});
