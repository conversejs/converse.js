import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from "@converse/headless";

const { Strophe } = converse.env;

class RoomsListModel extends Model {

    defaults () {  // eslint-disable-line class-methods-use-this
        return {
            'muc_domain': api.settings.get('muc_domain'),
            'nick': _converse.getDefaultMUCNickname(),
            'toggle_state':  _converse.OPENED,
        };
    }

    initialize () {
        super.initialize();
        api.settings.listen.on('change:muc_domain', (muc_domain) => this.setDomain(muc_domain));
    }

    setDomain (jid) {
        if (!api.settings.get('locked_muc_domain')) {
            this.save('muc_domain', Strophe.getDomainFromJid(jid));
        }
    }
}

export default RoomsListModel;
