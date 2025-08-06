import { Model } from '@converse/headless';

class MinimizedChatsToggle extends Model {
    defaults () { // eslint-disable-line class-methods-use-this
        return {
            'collapsed': false
        }
    }
}

export default MinimizedChatsToggle;
