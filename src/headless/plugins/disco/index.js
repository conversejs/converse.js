/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Converse plugin which add support for XEP-0030: Service Discovery
 */
import DiscoEntities from './entities.js';
import DiscoEntity from './entity.js';
import { _converse, api, converse } from '@converse/headless/core.js';
import {
    clearSession,
    initStreamFeatures,
    initializeDisco,
    notifyStreamFeaturesAdded,
    populateStreamFeatures
} from './utils.js';
import disco_api from './api.js';

const { Strophe } = converse.env;

converse.plugins.add('converse-disco', {
    initialize () {
        Object.assign(api, disco_api);

        api.promises.add('discoInitialized');
        api.promises.add('streamFeaturesAdded');

        _converse.DiscoEntity = DiscoEntity;
        _converse.DiscoEntities = DiscoEntities;

        _converse.disco = {
            _identities: [],
            _features: []
        };

        api.listen.on('userSessionInitialized', async () => {
            initStreamFeatures();
            if (_converse.connfeedback.get('connection_status') === Strophe.Status.ATTACHED) {
                // When re-attaching to a BOSH session, we fetch the stream features from the cache.
                await new Promise((success, error) => _converse.stream_features.fetch({ success, error }));
                notifyStreamFeaturesAdded();
            }
        });
        api.listen.on('beforeResourceBinding', populateStreamFeatures);
        api.listen.on('reconnected', initializeDisco);
        api.listen.on('connected', initializeDisco);

        api.listen.on('beforeTearDown', async () => {
            api.promises.add('streamFeaturesAdded');
            if (_converse.stream_features) {
                await _converse.stream_features.clearStore();
                delete _converse.stream_features;
            }
        });

        // All disco entities stored in sessionStorage and are refetched
        // upon login or reconnection and then stored with new ids, so to
        // avoid sessionStorage filling up, we remove them.
        api.listen.on('will-reconnect', clearSession);
        api.listen.on('clearSession', clearSession);
    }
});
