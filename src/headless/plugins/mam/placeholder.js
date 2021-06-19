import { Model } from '@converse/skeletor/src/model.js';
import { converse } from '../../core.js';

const u = converse.env.utils;

export default class MAMPlaceholderMessage extends Model {

    defaults () { // eslint-disable-line class-methods-use-this
        return {
            'msgid': u.getUniqueId(),
            'is_ephemeral': false
        };
    }
}
