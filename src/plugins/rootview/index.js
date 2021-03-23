import './root.js';
import { api, converse } from '@converse/headless/core';
import { ensureElement } from './utils.js';


converse.plugins.add('converse-rootview', {

    initialize () {
        api.settings.extend({ 'auto_insert': true });
        api.listen.on('chatBoxesInitialized', ensureElement);
    }
});
