import { _converse, api } from '@converse/headless/core';

export function onScrolledDown (model) {
    if (!model.isHidden()) {
        if (api.settings.get('allow_url_history_change')) {
            // Clear location hash if set to one of the messages in our history
            const hash = window.location.hash;
            hash && model.messages.get(hash.slice(1)) && _converse.router.history.navigate();
        }
    }
}
