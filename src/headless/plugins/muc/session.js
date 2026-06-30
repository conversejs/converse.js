import { Model } from '@converse/skeletor';
import { ROOMSTATUS } from './constants.js';

class MUCSession extends Model {
    defaults() {
        return {
            'connection_status': ROOMSTATUS.DISCONNECTED,
            // Whether the initial MAM history fetch that follows entering the
            // room has completed. Stays false until then so views can avoid
            // concluding (and rendering) that a room is empty while its history
            // is still being queried. Reset to false on each (re)join.
            'mam_initialized': false,
        };
    }
}

export default MUCSession;
