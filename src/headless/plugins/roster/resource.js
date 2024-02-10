import { Model } from '@converse/skeletor';

class Resource extends Model {
    get idAttribute () { // eslint-disable-line class-methods-use-this
        return 'name';
    }
}

export default Resource;
