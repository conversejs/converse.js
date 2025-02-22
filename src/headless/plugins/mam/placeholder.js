import { Model } from '@converse/skeletor';
import { getUniqueId } from '../../utils/index.js';

export default class MAMPlaceholderMessage extends Model {

    defaults () {
        return {
            msgid: getUniqueId(),
            is_ephemeral: false
        };
    }
}
