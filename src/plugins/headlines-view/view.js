import BaseChatView from 'shared/chat/baseview.js';
import tpl_headlines from './templates/headlines.js';
import { _converse, api } from '@converse/headless/core';


class HeadlinesFeedView extends BaseChatView {

    async initialize() {
        _converse.chatboxviews.add(this.jid, this);

        this.model = _converse.chatboxes.get(this.jid);
        this.model.disable_mam = true; // Don't do MAM queries for this box
        this.listenTo(_converse, 'windowStateChanged', this.onWindowStateChanged);
        this.listenTo(this.model, 'change:hidden', () => this.afterShown());
        this.listenTo(this.model, 'destroy', this.remove);
        this.listenTo(this.model.messages, 'add', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'remove', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'reset', () => this.requestUpdate());

        await this.model.messages.fetched;
        this.model.maybeShow();
        /**
         * Triggered once the { @link _converse.HeadlinesFeedView } has been initialized
         * @event _converse#headlinesBoxViewInitialized
         * @type { _converse.HeadlinesFeedView }
         * @example _converse.api.listen.on('headlinesBoxViewInitialized', view => { ... });
         */
        api.trigger('headlinesBoxViewInitialized', this);
    }

    render () {
        return tpl_headlines(this.model);
    }

    async close (ev) {
        ev?.preventDefault?.();
        if (_converse.router.history.getFragment() === 'converse/chat?jid=' + this.model.get('jid')) {
            _converse.router.navigate('');
        }
        await this.model.close(ev);
        return this;
    }

    getNotifications () { // eslint-disable-line class-methods-use-this
        // Override method in ChatBox. We don't show notifications for
        // headlines boxes.
        return [];
    }

    afterShown () {
        this.model.clearUnreadMsgCounter();
    }
}

api.elements.define('converse-headlines', HeadlinesFeedView);
