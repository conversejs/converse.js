import { converse } from '@converse/headless/core';
import { Model } from '@converse/skeletor/src/model.js';

const { Strophe } = converse.env;

const Bookmark = Model.extend({
    idAttribute: 'jid',
    getDisplayName () {
        return Strophe.xmlunescape(this.get('name'));
    }
});

export default Bookmark;
