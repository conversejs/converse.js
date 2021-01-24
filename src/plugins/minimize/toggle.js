import { Model } from '@converse/skeletor/src/model.js';

const MinimizedChatsToggle = Model.extend({
    defaults: {
        'collapsed': false
    }
});

export default MinimizedChatsToggle;
