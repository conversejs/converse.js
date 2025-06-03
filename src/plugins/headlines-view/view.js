import BaseChatView from 'shared/chat/baseview.js';
import { _converse, api } from '@converse/headless';
import tplHeadlines from './templates/headlines.js';

class HeadlinesFeedView extends BaseChatView {
    async initialize() {
        const { chatboxviews, chatboxes } = _converse.state;
        chatboxviews.add(this.jid, this);

        this.model = chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:hidden', () => this.afterShown());
        this.listenTo(this.model, 'destroy', this.remove);
        this.listenTo(this.model.messages, 'add', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'remove', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'reset', () => this.requestUpdate());

        document.addEventListener('visibilitychange', () => this.onWindowStateChanged());

        await this.model.messages.fetched;
        this.model.maybeShow();
        /**
         * Triggered once the {@link HeadlinesFeedView} has been initialized
         * @event _converse#headlinesBoxViewInitialized
         * @type {HeadlinesFeedView}
         * @example _converse.api.listen.on('headlinesBoxViewInitialized', view => { ... });
         */
        api.trigger('headlinesBoxViewInitialized', this);
    }

    render() {
        return tplHeadlines(this);
    }

    /**
     * @param {Event} ev
     */
    async close(ev) {
        ev?.preventDefault?.();
        if (location.hash === 'converse/chat?jid=' + this.model.get('jid')) {
            history.pushState(null, '', window.location.pathname);
        }
        await this.model.close(ev);
        return this;
    }

    getNotifications() {
        // eslint-disable-line class-methods-use-this
        // Override method in ChatBox. We don't show notifications for
        // headlines boxes.
        return [];
    }

    afterShown() {
        this.model.clearUnreadMsgCounter();
    }
}

api.elements.define('converse-headlines', HeadlinesFeedView);

export default HeadlinesFeedView;
