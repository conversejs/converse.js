import { Model } from '@converse/skeletor/src/model.js';
import { getUniqueId } from '../../utils/index.js';

export default class MAMPlaceholderMessage extends Model {

    defaults () { // eslint-disable-line class-methods-use-this
        return {
            'msgid': getUniqueId(),
            'is_ephemeral': false
        };
    }
}
