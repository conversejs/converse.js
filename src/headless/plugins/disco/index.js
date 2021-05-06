/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Converse plugin which add support for XEP-0030: Service Discovery
 */
import DiscoEntities from './entities.js';
import DiscoEntity from './entity.js';
import { _converse, api, converse } from '@converse/headless/core.js';
import { initializeDisco, initStreamFeatures, notifyStreamFeaturesAdded, populateStreamFeatures } from './utils.js';
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

        api.listen.on('clearSession', () => {
            if (_converse.shouldClearCache() && _converse.disco_entities) {
                Array.from(_converse.disco_entities.models).forEach(e => e.features.clearStore());
                Array.from(_converse.disco_entities.models).forEach(e => e.identities.clearStore());
                Array.from(_converse.disco_entities.models).forEach(e => e.dataforms.clearStore());
                Array.from(_converse.disco_entities.models).forEach(e => e.fields.clearStore());
                _converse.disco_entities.clearStore();
                delete _converse.disco_entities;
            }
        });
    }
});
