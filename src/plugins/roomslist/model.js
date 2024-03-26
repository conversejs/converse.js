import { Model } from '@converse/skeletor';
import { _converse, api, converse, constants } from "@converse/headless";

const { Strophe } = converse.env;
const { OPENED } = constants;

class RoomsListModel extends Model {

    defaults () {  // eslint-disable-line class-methods-use-this
        return {
            'muc_domain': api.settings.get('muc_domain'),
            'nick': _converse.exports.getDefaultMUCNickname(),
            'toggle_state':  OPENED,
            'collapsed_domains': [],
        };
    }

    initialize () {
        super.initialize();
        api.settings.listen.on(
            'change:muc_domain',
            /** @param {string} muc_domain */
            (muc_domain) => this.setDomain(muc_domain)
        );
    }

    /**
     * @param {string} jid
     */
    setDomain (jid) {
        if (!api.settings.get('locked_muc_domain')) {
            this.save('muc_domain', Strophe.getDomainFromJid(jid));
        }
    }
}

export default RoomsListModel;
