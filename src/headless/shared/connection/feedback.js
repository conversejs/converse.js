import _converse from '../_converse';
import { Model } from '@converse/skeletor/src/model.js';
import { Strophe } from 'strophe.js/src/strophe';

export default Model.extend({
    defaults: {
        'connection_status': Strophe.Status.DISCONNECTED,
        'message': ''
    },

    initialize () {
        const { api } = _converse;
        this.on('change', () => api.trigger('connfeedback', _converse.connfeedback));
    }
});
