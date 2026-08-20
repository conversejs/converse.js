import { api, u, _converse, constants } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { HashRouter, appOfHash } from 'plugins/rootview/routing.js';
import { CHAT_ROUTE_ROOT, buildChatRoute, parseChatRoute } from './routing.js';
import tplChats from './templates/chats.js';

const { PRIVATE_CHAT_TYPE, CHATROOMS_TYPE, CONTROLBOX_TYPE } = constants;

/**
 * The Chat app container. Renders the open chatboxes and, when
 * `enable_url_routing` is on and the view mode is `fullscreen`, keeps
 * `location.hash` in sync with the foregrounded conversation.
 *
 * Routing is bidirectional but non-looping:
 *  - hash -> foreground: `syncFromHash` -> `applyRoute` opens/backgrounds a box.
 *  - foreground -> hash: `syncHashToForeground` mirrors the open conversation with
 *    `replaceState` (no history entry, no `hashchange`, so it can't re-enter).
 *
 * A history entry (Back/Forward between conversations) is pushed only by a
 * user-initiated open via {@link ChatApp#navigate} (see ./navigation.js), never by
 * this mirror, so programmatic opens (boot auto-join, reconnection) don't spam the
 * back stack.
 */
class ChatApp extends CustomElement {
    constructor() {
        super();
        this.router = new HashRouter({ root: CHAT_ROUTE_ROOT, onRoute: () => this.syncFromHash() });

        // True while applyRoute is opening/backgrounding boxes, so the foreground
        // mirror stays quiet during the transition maybeShow makes across boxes.
        this._applying_route = false;
        this._foreground_scheduled = false;
    }

    initialize() {
        this.model = _converse.state.chatboxes;

        const onBoxesChanged = () => {
            this.requestUpdate();
            this.scheduleForegroundReflect();
        };
        this.listenTo(this.model, 'add', onBoxesChanged);
        this.listenTo(this.model, 'change:closed', onBoxesChanged);
        this.listenTo(this.model, 'change:hidden', onBoxesChanged);
        this.listenTo(this.model, 'change:jid', onBoxesChanged);
        this.listenTo(this.model, 'destroy', onBoxesChanged);

        // Use listenTo instead of api.listen.to so that event handlers
        // automatically get deregistered when the component is dismounted
        this.listenTo(_converse, 'connected', () => this.requestUpdate());
        this.listenTo(_converse, 'reconnected', () => this.requestUpdate());
        this.listenTo(_converse, 'disconnected', () => this.requestUpdate());

        const settings = api.settings.get();
        this.listenTo(settings, 'change:view_mode', () => this.requestUpdate());
        this.listenTo(settings, 'change:singleton', () => this.requestUpdate());

        const body = document.querySelector('body');
        body.classList.add(`converse-${api.settings.get('view_mode')}`);

        /**
         * Triggered once the ChatBoxViews view-collection has been initialized
         * @event _converse#chatBoxViewsInitialized
         * @example _converse.api.listen.on('chatBoxViewsInitialized', () => { ... });
         */
        api.trigger('chatBoxViewsInitialized');
    }

    connectedCallback() {
        super.connectedCallback();
        this.router.start();
    }

    disconnectedCallback() {
        this.router.stop();
        super.disconnectedCallback();
    }

    render() {
        return tplChats();
    }

    /**
     * Push a history entry for a user-initiated conversation open, so browser
     * Back/Forward walks the stack of opened conversations. The resulting
     * `hashchange` drives `applyRoute`.
     * @param {import('./types.ts').ChatRoute} route
     */
    navigate(route) {
        this.router.navigate(buildChatRoute(route));
    }

    /**
     * Derive the open conversation from the current hash. A hash that isn't a
     * Chat route (empty, or another app's route such as `#converse/social`) is ignored.
     */
    syncFromHash() {
        const route = parseChatRoute(location.hash);
        if (route) this.applyRoute(route);
    }

    /**
     * The single place the open conversation is set from a route. Gated on
     * fullscreen (in overlayed mode several boxes are open at once, so "the
     * foreground conversation" is ill-defined and this router stays dormant).
     * @param {import('./types.ts').ChatRoute} route
     */
    async applyRoute(route) {
        if (api.settings.get('view_mode') !== 'fullscreen') return;

        this._applying_route = true;
        try {
            if (route.view === 'chat') {
                await api.chats.open(route.jid, {}, true);
            } else if (route.view === 'room') {
                // Match legacy routeToRoom: don't race auto-join on a cold deep-link.
                await api.waitUntil('roomsAutoJoined');
                if (api.settings.get('allow_bookmarks')) await api.waitUntil('bookmarksInitialized');
                await api.rooms.open(route.jid, {}, true);
            } else {
                this.model
                    .filter((c) => c.get('type') !== CONTROLBOX_TYPE && !c.get('hidden') && !c.get('closed'))
                    .forEach((c) => u.safeSave(c, { hidden: true }));
            }
        } finally {
            this._applying_route = false;
        }
    }

    /**
     * The route mirroring the single foregrounded conversation, or the list when
     * none is shown. Only 1:1 chats and MUCs are routable; the controlbox and
     * headlines boxes are not.
     * @returns {import('./types.ts').ChatRoute}
     */
    currentForegroundRoute() {
        const box = this.model.find(
            (c) => [PRIVATE_CHAT_TYPE, CHATROOMS_TYPE].includes(c.get('type')) && !c.get('hidden') && !c.get('closed'),
        );
        if (!box) return { view: 'list' };
        return { view: box.get('type') === CHATROOMS_TYPE ? 'room' : 'chat', jid: box.get('jid') };
    }

    /**
     * Coalesce the foreground->hash mirror into one microtask, since maybeShow
     * flips `hidden` on several boxes in a single turn.
     */
    scheduleForegroundReflect() {
        if (this._foreground_scheduled) return;

        this._foreground_scheduled = true;
        queueMicrotask(() => {
            this._foreground_scheduled = false;
            this.syncHashToForeground();
        });
    }

    /**
     * Mirror the open conversation into `location.hash` via `replaceState`: no
     * history entry (that's `navigate`'s job) and no `hashchange` (so it can't
     * re-enter `syncFromHash`). A no-op unless routing is enabled and fullscreen,
     * while a route is being applied, or when the hash is already correct.
     */
    syncHashToForeground() {
        if (!this.router.enabled || api.settings.get('view_mode') !== 'fullscreen') return;
        if (this._applying_route) return;

        // Never clobber another app's route (e.g. `#converse/social` during the
        // boot window before the app-switcher makes the Chat app inactive and
        // unmounts us). Only own an empty/root hash or an existing chat/room one.
        const owner = appOfHash(location.hash);
        if (owner && owner !== 'chat') return;

        const hash = buildChatRoute(this.currentForegroundRoute());
        if (!hash || hash === location.hash) return;

        this.router.replace(hash);
    }
}

api.elements.define('converse-app-chat', ChatApp);
