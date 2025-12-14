import { _converse, api, converse, constants, Model } from "@converse/headless";

const { Strophe } = converse.env;
const { OPENED } = constants;

/**
 * @extends {Model<import("./types").RoomsListAttrs>}
 */
class RoomsListModel extends Model {

    defaults () {
        return {
            muc_domain: api.settings.get('muc_domain'),
            toggle_state:  OPENED,
            collapsed_domains: [],
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
