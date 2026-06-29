import { Model } from '@converse/skeletor';

class Resource extends Model {
    get idAttribute() {
        return 'name';
    }
}

export default Resource;
