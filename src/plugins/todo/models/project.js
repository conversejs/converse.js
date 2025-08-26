import { Model } from '@converse/skeletor';

export default class Project extends Model {
    get idAttribute() {
        return 'jid';
    }
}
