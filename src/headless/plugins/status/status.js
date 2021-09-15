import isNaN from 'lodash-es/isNaN';
import isObject from 'lodash-es/isObject';
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from '@converse/headless/core';

const { Strophe, $pres } = converse.env;

const XMPPStatus = Model.extend({
    defaults () {
        return { "status":  api.settings.get("default_state") }
    },

    initialize () {
        this.on('change', item => {
            if (!isObject(item.changed)) {
                return;
            }
            if ('status' in item.changed || 'status_message' in item.changed) {
                api.user.presence.send(this.get('status'), null, this.get('status_message'));
            }
        });
    },

    getNickname () {
        return api.settings.get('nickname');
    },

    getFullname () {
        // Gets overridden in converse-vcard
        return '';
    },

    async constructPresence (type, to=null, status_message) {
        type = typeof type === 'string' ? type : (this.get('status') || api.settings.get("default_state"));
        status_message = typeof status_message === 'string' ? status_message : this.get('status_message');
        let presence;
        const attrs = {to};
        if ((type === 'unavailable') ||
                (type === 'probe') ||
                (type === 'error') ||
                (type === 'unsubscribe') ||
                (type === 'unsubscribed') ||
                (type === 'subscribe') ||
                (type === 'subscribed')) {
            attrs['type'] = type;
            presence = $pres(attrs);
        } else if (type === 'offline') {
            attrs['type'] = 'unavailable';
            presence = $pres(attrs);
        } else if (type === 'online') {
            presence = $pres(attrs);
        } else {
            presence = $pres(attrs).c('show').t(type).up();
        }

        if (status_message) {
            presence.c('status').t(status_message).up();
        }

        const priority = api.settings.get("priority");
        presence.c('priority').t(isNaN(Number(priority)) ? 0 : priority).up();
        if (_converse.idle) {
            const idle_since = new Date();
            idle_since.setSeconds(idle_since.getSeconds() - _converse.idle_seconds);
            presence.c('idle', {xmlns: Strophe.NS.IDLE, since: idle_since.toISOString()});
        }
        presence = await api.hook('constructedPresence', null, presence);
        return presence;
    }
});

export default XMPPStatus;
