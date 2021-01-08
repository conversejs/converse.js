import { converse } from '@converse/headless/core';

const { Strophe } = converse.env;

const Bookmark = {
    idAttribute: 'jid',
    getDisplayName () {
        return Strophe.xmlunescape(this.get('name'));
    }
};

export default Bookmark;
