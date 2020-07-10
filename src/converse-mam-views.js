/**
 * @module converse-mam-views
 * @description
 * Views for XEP-0313 Message Archive Management
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, converse } from "@converse/headless/converse-core";


converse.plugins.add('converse-mam-views', {

    dependencies: ['converse-mam', 'converse-chatview', 'converse-muc-views'],

    initialize () {
        api.listen.on('chatBoxScrolledUp', async view => {
            if (view.model.messages.length) {
                const oldest_message = view.model.getOldestMessage();
                if (oldest_message) {
                    const by_jid = view.model.get('jid');
                    const stanza_id = oldest_message && oldest_message.get(`stanza_id ${by_jid}`);
                    view.addSpinner();
                    if (stanza_id) {
                        await view.model.fetchArchivedMessages({'before': stanza_id});
                    } else {
                        await view.model.fetchArchivedMessages({'end': oldest_message.get('time')});
                    }
                    view.clearSpinner();
                }
            }
        });
    }
});
