import { Model } from '@converse/skeletor';
import { ROOMSTATUS } from './constants';

class MUCSession extends Model {
    defaults() {
        return {
            'connection_status': ROOMSTATUS.DISCONNECTED,
        };
    }
}

export default MUCSession;
