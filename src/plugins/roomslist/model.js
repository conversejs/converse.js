import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from "@converse/headless/core";

const { Strophe } = converse.env;

const RoomsListModel = Model.extend({

    defaults: function () {
        return {
            'muc_domain': api.settings.get('muc_domain'),
            'nick': _converse.getDefaultMUCNickname(),
            'toggle-state':  _converse.OPENED,
        };
    },

    initialize () {
        api.settings.listen.on('change:muc_domain', (muc_domain) => this.setDomain(muc_domain));
    },

    setDomain (jid) {
        if (!api.settings.get('locked_muc_domain')) {
            this.save('muc_domain', Strophe.getDomainFromJid(jid));
        }
    }
});

export default RoomsListModel;

