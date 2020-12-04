import { View } from '@converse/skeletor/src/view';
import { api } from '@converse/headless/core';

const ControlBoxPane = View.extend({
    tagName: 'div',
    className: 'controlbox-pane',

    initialize () {
        /**
         * Triggered once the {@link _converse.ControlBoxPane} has been initialized
         * @event _converse#controlBoxPaneInitialized
         * @type { _converse.ControlBoxPane }
         * @example _converse.api.listen.on('controlBoxPaneInitialized', view => { ... });
         */
        api.trigger('controlBoxPaneInitialized', this);
    }
});

export default ControlBoxPane;
