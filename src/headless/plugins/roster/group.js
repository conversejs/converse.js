import { Model } from '@converse/skeletor/src/model.js';
import { __ } from 'i18n';
import { _converse } from "@converse/headless/core";


const RosterGroup = Model.extend({

    initialize (attributes) {
        this.set(Object.assign({
            description: __('Click to hide these contacts'),
            state: _converse.OPENED
        }, attributes));
        // Collection of contacts belonging to this group.
        this.contacts = new _converse.RosterContacts();
    }
});

export default RosterGroup;
