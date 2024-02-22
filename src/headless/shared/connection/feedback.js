import _converse from '../_converse';
import { Model } from '@converse/skeletor';
import { Strophe } from 'strophe.js';


class Feedback extends Model {

    defaults () {
        return {
            'connection_status': Strophe.Status.DISCONNECTED,
            'message': '',
        }
    }

    initialize () {
        super.initialize();
        const { api } = _converse;
        this.on('change', () => api.trigger('connfeedback', _converse.state.connfeedback));
    }
}

export default Feedback;
