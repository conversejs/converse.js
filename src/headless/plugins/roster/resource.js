import { Model } from '@converse/skeletor/src/model.js';

class Resource extends Model {
    get idAttribute () { // eslint-disable-line class-methods-use-this
        return 'name';
    }
}

export default Resource;
