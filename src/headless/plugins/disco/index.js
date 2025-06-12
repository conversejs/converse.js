/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Converse plugin which add support for XEP-0030: Service Discovery
 */
import DiscoEntities from './entities.js';
import DiscoEntity from './entity.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import disco_api from './api.js';
import {
    clearSession,
    initStreamFeatures,
    initializeDisco,
    notifyStreamFeaturesAdded,
    populateStreamFeatures
} from './utils.js';

const { Strophe } = converse.env;

/**
 * @typedef {Object} DiscoState
 * @property {Array} _identities
 * @property {Array} _features
 */

converse.plugins.add('converse-disco', {
    initialize () {
        Object.assign(api, disco_api);

        api.promises.add('discoInitialized');
        api.promises.add('streamFeaturesAdded');

        const exports = { DiscoEntity, DiscoEntities };

        Object.assign(_converse, exports); // XXX: DEPRECATED
        Object.assign(_converse.exports, exports);

        const disco = {
            _identities: [],
            _features: []
        };
        Object.assign(_converse, { disco }); // XXX: DEPRECATED
        Object.assign(_converse.state, { disco });

        api.listen.on('userSessionInitialized', async () => {
            initStreamFeatures();
            if (_converse.state.connfeedback.get('connection_status') === Strophe.Status.ATTACHED) {
                // When re-attaching to a BOSH session, we fetch the stream features from the cache.
                await new Promise((success, error) => _converse.state.stream_features.fetch({ success, error }));
                notifyStreamFeaturesAdded();
            }
        });
        api.listen.on('beforeResourceBinding', populateStreamFeatures);
        api.listen.on('reconnected', initializeDisco);
        api.listen.on('connected', initializeDisco);

        api.listen.on('beforeTearDown', async () => {
            api.promises.add('streamFeaturesAdded');
            api.promises.add('discoInitialized');

            const { stream_features } = _converse.state;
            if (stream_features) {
                await stream_features.clearStore();
                delete _converse.state.stream_features;
                Object.assign(_converse, { stream_features: undefined }); // XXX: DEPRECATED
            }
        });

        // All disco entities stored in sessionStorage and are refetched
        // upon login or reconnection and then stored with new ids, so to
        // avoid sessionStorage filling up, we remove them.
        api.listen.on('will-reconnect', clearSession);
        api.listen.on('clearSession', clearSession);
    }
});
