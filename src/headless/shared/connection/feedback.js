import _converse from '../_converse';
import { Model } from '@converse/skeletor';
import { Strophe } from 'strophe.js';


class Feedback extends Model {

    defaults () { // eslint-disable-line class-methods-use-this
        return {
            'connection_status': Strophe.Status.DISCONNECTED,
            'message': '',
        }
    }

    initialize () {
        super.initialize();
        const { api } = _converse;
        this.on('change', () => api.trigger('connfeedback', _converse.connfeedback));
    }
}

export default Feedback;
