import Profile from './profile.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import status_api from './api.js';
import { shouldClearCache } from '../../utils/session.js';
import { initStatus } from './utils.js';

converse.plugins.add('converse-status', {
    initialize() {
        api.settings.extend({ priority: 0 });
        api.promises.add(['statusInitialized']);

        const exports = {
            XMPPStatus: Profile, // Deprecated
            Profile,
        };
        Object.assign(_converse, exports); // Deprecated
        Object.assign(_converse.exports, exports);
        Object.assign(_converse.api.user, status_api);

        api.listen.on('clearSession', () => {
            if (shouldClearCache(_converse) && _converse.state.profile) {
                _converse.state.profile.destroy();
                delete _converse.state.profile;
                Object.assign(_converse, { profile: undefined }); // XXX DEPRECATED
                api.promises.add(['statusInitialized']);
            }
        });

        api.listen.on('connected', () => initStatus(false));
        api.listen.on('reconnected', () => initStatus(true));
    },
});
