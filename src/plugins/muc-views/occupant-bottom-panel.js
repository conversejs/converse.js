import { _converse, api } from '@converse/headless';
import { __ } from 'i18n';
import 'shared/autocomplete/index.js';
import BottomPanel from 'plugins/chatview/bottom-panel.js';
import tplBottomPanel from './templates/occupant-bottom-panel.js';

import './styles/occupant-bottom-panel.scss';

export default class OccupantBottomPanel extends BottomPanel {
    static get properties() {
        return {
            model: { type: Object, noAccessor: true },
            muc: { type: Object },
        };
    }

    constructor() {
        super();
        this.muc = null;
    }

    async initialize() {
        await super.initialize();
        this.listenTo(this.muc.session, 'change:connection_status', () => this.requestUpdate());
    }

    render() {
        if (!this.model) return '';
        return tplBottomPanel(this);
    }

    canPostMessages() {
        return this.muc.isEntered() && this.model.get('show') !== 'offline';
    }

    openChat() {
        const jid = this.model.get('jid');
        return jid ? api.chats.open(jid, {}, true) : api.alert('error', __('Error'), 'Could not find XMPP address');
    }

    invite() {
        const jid = this.model.get('jid');
        api.listen.once('roomInviteSent', () =>
            api.alert('info', __('Success'), __('The user has been invited to join this groupchat'))
        );
        return jid ? this.muc.directInvite(jid) : api.alert('error', __('Error'), 'Could not find XMPP address');
    }
}

api.elements.define('converse-occupant-bottom-panel', OccupantBottomPanel);
