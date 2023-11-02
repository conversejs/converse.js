import _converse from '../../shared/_converse.js';
import { Model } from '@converse/skeletor';

/**
 * Represents a VCard
 * @namespace _converse.VCard
 * @memberOf _converse
 */
class VCard extends Model {
    get idAttribute () { // eslint-disable-line class-methods-use-this
        return 'jid';
    }

    defaults () { // eslint-disable-line class-methods-use-this
        return {
            'image': _converse.DEFAULT_IMAGE,
            'image_type': _converse.DEFAULT_IMAGE_TYPE
        }
    }

    set (key, val, options) {
        // Override Model.prototype.set to make sure that the
        // default `image` and `image_type` values are maintained.
        let attrs;
        if (typeof key === 'object') {
            attrs = key;
            options = val;
        } else {
            (attrs = {})[key] = val;
        }
        if ('image' in attrs && !attrs['image']) {
            attrs['image'] = _converse.DEFAULT_IMAGE;
            attrs['image_type'] = _converse.DEFAULT_IMAGE_TYPE;
            return Model.prototype.set.call(this, attrs, options);
        } else {
            return Model.prototype.set.apply(this, arguments);
        }
    }

    getDisplayName () {
        return this.get('nickname') || this.get('fullname') || this.get('jid');
    }
}

export default VCard;
