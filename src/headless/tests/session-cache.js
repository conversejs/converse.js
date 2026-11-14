import mock from '../tests/mock.js';
import converse from '../dist/converse-headless.js';

const { Model, Strophe, sizzle, stx, u } = converse.env;

const SETTINGS = {
    bosh_service_url: 'montague.lit/http-bind',
    discover_connection_methods: false,
    enable_smacks: false,
    i18n: 'en',
    loglevel: 'error',
    no_trimming: true,
    persistent_store: 'localStorage',
};

/** The prototype of the mock connection, whose `connect` goes nowhere while there's no network. */
let connection_proto;

const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

/**
 * Runs a first session, with contacts, a chat with a message, and a status
 * message, which it leaves in the cache.
 * @param {any} _converse
 */
async function runFirstSession(_converse) {
    const { api, state } = _converse;
    connection_proto = Object.getPrototypeOf(api.connection.get());
    await mock.waitForRoster(_converse, 'current');
    state.roster.data.save('version', 'ver1');
    await api.user.status.message.set('On a train');

    const chat = await api.chats.open(contact_jid);
    await chat.messages.create({ body: 'See you there', type: 'chat', from: contact_jid, msgid: 'msg1' });
}

/**
 * Starts Converse again, as a page load would, with no network. The returned
 * function brings the network back and retries straight away.
 * @param {any} _converse
 * @param {object} [settings]
 * @param {object} [options]
 * @param {boolean} [options.restart] - Whether the app is started anew, which
 *  loses sessionStorage, rather than the page being reloaded.
 * @returns {Promise<() => Promise<void>>}
 */
async function reloadOffline(_converse, settings = {}, { restart = false } = {}) {
    const { api } = _converse;
    if (restart) {
        Object.keys(sessionStorage).forEach((k) => k.match(/^converse-test-session/) && sessionStorage.removeItem(k));
    } else {
        // As the unload handler does
        u.safeSave(_converse.session, { active: false });
    }
    // The page's memory is gone either way. What's on disk stays.
    _converse.state.session = _converse.session = new Model();
    delete _converse.storage.persistent;
    delete _converse.state.login_info;

    // The attempt goes nowhere, as if the network were down.
    const connect = vi.spyOn(connection_proto, 'connect').mockImplementation(function (_jid, _password, callback) {
        this.connect_callback = callback ?? this.onConnectStatusChanged;
    });
    const vcard_get = api.vcard.get;

    await converse.initialize({ ...SETTINGS, password: 'secret', ...settings });
    api.vcard.get = vcard_get;

    // The next test only logs out of a session that connected, so it would
    // otherwise carry on with this one.
    onTestFinished(() => {
        if (!api.connection.connected()) _converse.initSession();
    });
    return async () => {
        connect.mockRestore();
        await api.connection.reconnect();
    };
}

/**
 * A SASL failure, as Strophe reports a failed authentication with.
 * @param {string} condition
 * @returns {Element}
 */
function saslFailure(condition) {
    const xml = `<failure xmlns="${Strophe.NS.SASL}"><${condition}/></failure>`;
    return new DOMParser().parseFromString(xml, 'text/xml').documentElement;
}

/**
 * @param {any} spy - A spy on `api.trigger`
 * @param {string} name
 */
function countEvents(spy, name) {
    return spy.mock.calls.filter(([n]) => n === name).length;
}

describe('A remembered session', function () {
    it(
        'is loaded from the cache on a page load without a network, and connects in the background',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            await runFirstSession(_converse);

            const trigger = vi.spyOn(api, 'trigger');
            const goOnline = await reloadOffline(_converse);
            const connection = api.connection.get();

            // Readable without a connection
            expect(connection.authenticated).toBeFalsy();
            const profile = state.profile;
            expect(await api.user.status.message.get()).toBe('On a train');
            const roster = state.roster;
            const contact = await api.contacts.get(contact_jid);
            expect(contact.get('subscription')).toBe('both');
            const chat = await api.chats.get(contact_jid);
            const message = chat.messages.findWhere({ msgid: 'msg1' });
            expect(message.get('body')).toBe('See you there');

            // Nothing is sent before authenticating
            expect(connection.sent_stanzas.length).toBe(0);
            expect(countEvents(trigger, 'rosterContactsFetched')).toBe(1);

            await goOnline();
            await u.waitUntil(() => connection.sent_stanzas.some((s) => s.nodeName === 'presence'));

            // What callers already hold is kept, not replaced
            expect(state.profile).toBe(profile);
            expect(state.roster).toBe(roster);
            expect(await api.contacts.get(contact_jid)).toBe(contact);
            expect(await api.chats.get(contact_jid)).toBe(chat);
            expect(chat.messages.findWhere({ msgid: 'msg1' })).toBe(message);

            expect(countEvents(trigger, 'connected')).toBe(1);
            expect(countEvents(trigger, 'reconnected')).toBe(0);
            expect(countEvents(trigger, 'rosterContactsFetched')).toBe(1);
        }),
    );

    it(
        'keeps what changed in its contacts offline once connected',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);
            // The chat counts its unread messages on its contact too.
            (await api.chats.get(contact_jid)).save({ num_unread: 2 });
            await u.waitUntil(async () => (await api.contacts.get(contact_jid)).get('num_unread') === 2);

            const goOnline = await reloadOffline(_converse);
            const contact = await api.contacts.get(contact_jid);
            expect(contact.get('num_unread')).toBe(2);
            // The chat is read.
            (await api.chats.get(contact_jid)).save({ num_unread: 0 });
            expect(contact.get('num_unread')).toBe(0);

            await goOnline();
            await api.waitUntil('presencesInitialized');
            await contact.initialized;
            expect(contact.get('num_unread')).toBe(0);
        }),
    );

    it(
        'tells what waits for its stream features once connected',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);
            const goOnline = await reloadOffline(_converse);

            let added = false;
            api.waitUntil('streamFeaturesAdded').then(() => (added = true));
            await goOnline();
            await u.waitUntil(() => added);
        }),
    );

    it(
        'has its roster updated with roster versioning when the app is started anew',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);

            const trigger = vi.spyOn(api, 'trigger');
            const goOnline = await reloadOffline(_converse, {}, { restart: true });
            const connection = api.connection.get();
            const contact = await api.contacts.get(contact_jid);
            expect(connection.sent_stanzas.length).toBe(0);

            await goOnline();
            const roster_query = `iq[type="get"] query[xmlns="${Strophe.NS.ROSTER}"]`;
            const iq = await u.waitUntil(() => connection.IQ_stanzas.find((s) => sizzle(roster_query, s).length));
            expect(sizzle(roster_query, iq).pop().getAttribute('ver')).toBe('ver1');
            connection._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<iq type="result" id="${iq.getAttribute('id')}" to="${connection.jid}" xmlns="jabber:client"/>`,
                ),
            );
            await u.waitUntil(() => connection.sent_stanzas.some((s) => s.nodeName === 'presence'));

            expect(await api.contacts.get(contact_jid)).toBe(contact);
            expect(countEvents(trigger, 'rosterContactsFetched')).toBe(1);
            expect(countEvents(trigger, 'connected')).toBe(1);
        }),
    );

    it(
        'has an empty roster offline if the server sent it one',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            connection_proto = Object.getPrototypeOf(api.connection.get());
            await mock.waitForRoster(_converse, 'current', 0);

            await reloadOffline(_converse);
            expect(await api.contacts.get()).toEqual([]);
        }),
    );

    it(
        'shows the messages of a chat with someone who is blocked and not a contact',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, exports, state } = _converse;
            await runFirstSession(_converse);
            const jid = 'nurse@capulet.lit';
            state.session.set('converse.blocklist-romeo@montague.lit-fetched', true);
            state.blocklist = new exports.Blocklist();
            (await api.blocklist.get()).create({ jid });
            const chat = await api.chats.open(jid);
            await chat.messages.create({ body: 'He is hid at Laurence cell', type: 'chat', from: jid, msgid: 'msg2' });

            // A page load starts without the earlier session's blocklist.
            api.promises.add('blocklistInitialized');
            delete state.blocklist;
            await reloadOffline(_converse);
            expect((await api.blocklist.get()).get(jid)).toBeDefined();
            expect(await api.contacts.get(jid)).toBeUndefined();

            const cached = await api.chats.get(jid);
            await cached.initialized;
            expect(cached.messages.findWhere({ msgid: 'msg2' }).get('body')).toBe('He is hid at Laurence cell');
        }),
    );

    it(
        'is still resumed if a plugin fails to load what it cached',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);

            const trigger = api.trigger;
            vi.spyOn(api, 'trigger').mockImplementation(async (name, ...args) => {
                await trigger(name, ...args);
                if (name === 'loadSessionCache') throw new Error('A plugin failed to load its cache');
            });
            await reloadOffline(_converse);
            expect(api.connection.remembered()).toBe(true);
            expect(await api.contacts.get(contact_jid)).toBeDefined();
        }),
    );

    it(
        'is not loaded after logging out',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);
            await api.user.logout();

            const trigger = vi.spyOn(api, 'trigger');
            await reloadOffline(_converse);
            expect(countEvents(trigger, 'loadSessionCache')).toBe(0);
            expect(_converse.session.get('jid')).toBeUndefined();
        }),
    );

    it(
        'is not loaded on a device that clears its cache',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);

            const trigger = vi.spyOn(api, 'trigger');
            await reloadOffline(_converse, { clear_cache_on_logout: true });
            expect(countEvents(trigger, 'loadSessionCache')).toBe(0);
        }),
    );

    it(
        'is not loaded when there is no way to log in again without the user',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);

            const trigger = vi.spyOn(api, 'trigger');
            await reloadOffline(_converse, { password: undefined });
            expect(countEvents(trigger, 'loadSessionCache')).toBe(0);
        }),
    );

    it(
        'is loaded on a page load with its stored SCRAM keys',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            await runFirstSession(_converse);
            const { login_info } = state;
            await new Promise((success) => login_info.save({ scram_keys: { ck: 'ck' } }, { success }));
            onTestFinished(() => {
                const info = state.login_info ?? login_info;
                return new Promise((success) => info.save({ scram_keys: null }, { success }));
            });

            const trigger = vi.spyOn(api, 'trigger');
            await reloadOffline(_converse, { password: undefined });
            expect(countEvents(trigger, 'loadSessionCache')).toBe(1);
        }),
    );

    it(
        "is loaded with a password the browser's credential store hands over without asking",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);

            const get = vi
                .spyOn(navigator.credentials, 'get')
                .mockResolvedValue(
                    /** @type {any} */ ({ type: 'password', id: 'romeo@montague.lit', password: 'stored' }),
                );
            const trigger = vi.spyOn(api, 'trigger');
            await reloadOffline(_converse, { password: undefined });

            expect(get).toHaveBeenCalledWith({ password: true, mediation: 'silent' });
            expect(countEvents(trigger, 'loadSessionCache')).toBe(1);
            const [jid, password] = vi.mocked(connection_proto.connect).mock.calls.at(-1);
            expect(Strophe.getBareJidFromJid(jid)).toBe('romeo@montague.lit');
            expect(password).toBe('stored');
        }),
    );

    it(
        "is not loaded when the browser's credential store won't hand over its password without asking",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);

            const trigger = vi.spyOn(api, 'trigger');
            const get = vi.spyOn(navigator.credentials, 'get').mockResolvedValue(null);
            await reloadOffline(_converse, { password: undefined });
            expect(countEvents(trigger, 'loadSessionCache')).toBe(0);

            // Nor with the password of another account
            get.mockResolvedValue(/** @type {any} */ ({ type: 'password', id: 'juliet@montague.lit', password: 's' }));
            await reloadOffline(_converse, { password: undefined });
            expect(countEvents(trigger, 'loadSessionCache')).toBe(0);
        }),
    );

    it(
        'is not loaded before the server has checked a password typed into the login form',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);

            const trigger = vi.spyOn(api, 'trigger');
            await reloadOffline(_converse, { password: undefined });
            // The login form calls this with what was typed in.
            await api.user.login('romeo@montague.lit', 'guessed');
            expect(countEvents(trigger, 'loadSessionCache')).toBe(0);
            expect(countEvents(trigger, 'rosterContactsFetched')).toBe(0);
            expect(countEvents(trigger, 'chatBoxesFetched')).toBe(0);
        }),
    );
});

describe('A resumed session', function () {
    it(
        'keeps retrying through network failures, without giving up',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);
            await reloadOffline(_converse);
            const connection = api.connection.get();
            const finish = vi.spyOn(connection, 'finishDisconnection').mockResolvedValue(undefined);
            const reconnect = vi.spyOn(connection, 'requestReconnect').mockImplementation(() => {});

            // A first connection that keeps failing would be given up on after one retry.
            for (const reason of [undefined, 'remote-connection-failed']) {
                connection.reconnecting = true;
                connection.status = Strophe.Status.CONNECTING;
                connection.setDisconnectionCause(Strophe.Status.CONNFAIL, reason, true);
                connection.onDisconnected();
            }
            expect(finish).not.toHaveBeenCalled();
            expect(reconnect).toHaveBeenCalledTimes(2);
            delete connection.reconnecting;
        }),
    );

    it(
        'ends, as if logged out, when the server rejects its credentials',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            await runFirstSession(_converse);
            const trigger = vi.spyOn(api, 'trigger');
            await reloadOffline(_converse);
            expect(countEvents(trigger, 'loadSessionCache')).toBe(1);

            // Through the callback Strophe was given, as Strophe reports it.
            api.connection.get().connect_callback(Strophe.Status.AUTHFAIL, null, saslFailure('not-authorized'));
            await u.waitUntil(() => countEvents(trigger, 'logout') === 1);
            expect(countEvents(trigger, 'disconnected')).toBe(1);

            expect(state.connfeedback.get('message')).toMatch(/password is incorrect/);
            expect(state.roster).toBeUndefined();
            expect(state.profile).toBeUndefined();
            expect(state.chatboxes.get(contact_jid)).toBeUndefined();

            // Nor is it resumed the next time
            trigger.mockClear();
            await reloadOffline(_converse);
            expect(countEvents(trigger, 'loadSessionCache')).toBe(0);
        }),
    );

    it(
        'keeps retrying when authenticating fails for now, or for something other than its credentials',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            await runFirstSession(_converse);
            await reloadOffline(_converse);
            const connection = api.connection.get();
            const finish = vi.spyOn(connection, 'finishDisconnection');
            const reconnect = vi.spyOn(connection, 'requestReconnect').mockImplementation(() => {});

            connection.onConnectStatusChanged(Strophe.Status.AUTHFAIL, null, saslFailure('temporary-auth-failure'));
            // A resource that couldn't be bound
            const bind_error = new DOMParser().parseFromString(
                `<iq xmlns="jabber:client" type="error"><error type="cancel">` +
                    `<conflict xmlns="${Strophe.NS.STANZAS}"/></error></iq>`,
                'text/xml',
            ).documentElement;
            connection.onConnectStatusChanged(Strophe.Status.AUTHFAIL, Strophe.ErrorCondition.CONFLICT, bind_error);

            expect(reconnect).toHaveBeenCalledTimes(2);
            expect(finish).not.toHaveBeenCalled();
            expect(state.roster).toBeDefined();
        }),
    );

    it(
        'ends when Strophe gives up on authenticating, for example with stale SCRAM keys',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);
            await reloadOffline(_converse);
            const connection = api.connection.get();
            const finish = vi.spyOn(connection, 'finishDisconnection').mockResolvedValue(undefined);
            const reconnect = vi.spyOn(connection, 'requestReconnect').mockImplementation(() => {});

            // As Strophe reports it, without a <failure> from the server
            connection.connect_callback(Strophe.Status.AUTHFAIL, null, null);
            expect(finish).toHaveBeenCalledOnce();
            expect(reconnect).not.toHaveBeenCalled();
        }),
    );

    it(
        'ends, as if logged out, when it no longer has credentials to log in with',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            await runFirstSession(_converse);
            const trigger = vi.spyOn(api, 'trigger');
            const goOnline = await reloadOffline(_converse);
            expect(countEvents(trigger, 'loadSessionCache')).toBe(1);

            // For example, the stored password was removed while offline.
            api.settings.set('password', '');
            delete api.connection.get().pass;
            await goOnline();
            await u.waitUntil(() => countEvents(trigger, 'logout') === 1);
            expect(countEvents(trigger, 'disconnected')).toBe(1);

            expect(state.connfeedback.get('message')).toMatch(/log in again/);
            expect(state.roster).toBeUndefined();
            expect(state.chatboxes.get(contact_jid)).toBeUndefined();

            trigger.mockClear();
            await reloadOffline(_converse);
            expect(countEvents(trigger, 'loadSessionCache')).toBe(0);
        }),
    );

    it(
        'is logged out of before another account logs in',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            await runFirstSession(_converse);
            const roster = state.roster;

            // For example, `credentials_url` returns another account after
            // another user logged into the hosting site.
            const juliet = 'juliet@montague.lit';
            // A listener would be removed by initializing again.
            const hook = api.hook;
            vi.spyOn(api, 'hook').mockImplementation(async (name, context, data) => {
                const result = await hook(name, context, data);
                if (name !== 'beforeAttemptNonPreboundSession') return result;

                return { ...result, credentials: { jid: juliet, password: 'secret' } };
            });
            const bind = connection_proto.bind;
            vi.spyOn(connection_proto, 'bind').mockImplementation(function () {
                this.jid = `${juliet}/balcony`;
                return bind.call(this);
            });
            const trigger = vi.spyOn(api, 'trigger');

            // The first attempt gets the other account's credentials,
            // before the resumed session has tried to connect.
            const goOnline = await reloadOffline(_converse);
            expect(countEvents(trigger, 'loadSessionCache')).toBe(1);
            expect(countEvents(trigger, 'logout')).toBe(1);
            expect(state.chatboxes.get(contact_jid)).toBeUndefined();

            vi.mocked(api.hook).mockRestore();
            await goOnline();
            await u.waitUntil(() => countEvents(trigger, 'connected') === 1);

            expect(_converse.session.get('bare_jid')).toBe(juliet);
            await api.waitUntil('presencesInitialized');
            expect(state.roster).not.toBe(roster);
        }),
    );
});

describe('A session logged into on a trusted device', function () {
    it(
        'is remembered, and kept through a remote connection failure',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            expect(api.connection.remembered()).toBe(true);
            const finish = vi.spyOn(connection, 'finishDisconnection').mockResolvedValue(undefined);
            const reconnect = vi.spyOn(connection, 'requestReconnect').mockImplementation(() => {});

            connection.setDisconnectionCause(Strophe.Status.CONNFAIL, 'remote-connection-failed', true);
            connection.onDisconnected();
            expect(finish).not.toHaveBeenCalled();
            expect(reconnect).toHaveBeenCalledOnce();
            connection.setDisconnectionCause();
        }),
    );

    it(
        'is not remembered on a device that clears its cache, and stops on a remote connection failure',
        mock.initConverse(converse, ['chatBoxesFetched'], { clear_cache_on_logout: true }, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            expect(api.connection.remembered()).toBe(false);
            const finish = vi.spyOn(connection, 'finishDisconnection').mockResolvedValue(undefined);
            const reconnect = vi.spyOn(connection, 'requestReconnect').mockImplementation(() => {});

            connection.setDisconnectionCause(Strophe.Status.CONNFAIL, 'remote-connection-failed', true);
            connection.onDisconnected();
            expect(finish).toHaveBeenCalledOnce();
            expect(reconnect).not.toHaveBeenCalled();
            connection.setDisconnectionCause();
        }),
    );

    it(
        'keeps retrying when authenticating fails for now',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const finish = vi.spyOn(connection, 'finishDisconnection');
            const reconnect = vi.spyOn(connection, 'requestReconnect').mockImplementation(() => {});

            connection.onConnectStatusChanged(Strophe.Status.AUTHFAIL, null, saslFailure('temporary-auth-failure'));
            expect(reconnect).toHaveBeenCalledOnce();
            expect(finish).not.toHaveBeenCalled();
        }),
    );

    it(
        'ends, as if logged out, when the server rejects its credentials',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);
            const trigger = vi.spyOn(api, 'trigger');

            // For example, the password was changed on another device.
            api.connection.get().onConnectStatusChanged(Strophe.Status.AUTHFAIL, null, saslFailure('not-authorized'));
            await u.waitUntil(() => countEvents(trigger, 'logout') === 1);

            // Nor is it resumed the next time
            trigger.mockClear();
            await reloadOffline(_converse);
            expect(countEvents(trigger, 'loadSessionCache')).toBe(0);
        }),
    );

    it(
        'can be logged out of while it retries without a network',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);
            await reloadOffline(_converse);
            const connection = api.connection.get();
            expect(connection.connected).toBeFalsy();
            const trigger = vi.spyOn(api, 'trigger');

            await api.user.logout();
            expect(countEvents(trigger, 'logout')).toBe(1);
            expect(api.connection.get()).toBeUndefined();

            trigger.mockClear();
            await reloadOffline(_converse);
            expect(countEvents(trigger, 'loadSessionCache')).toBe(0);
        }),
    );
});

describe('Retrying the connection now (api.connection.retry)', function () {
    it(
        'starts the waits between retries from the shortest again',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const connection = _converse.api.connection.get();
            const reconnect = vi.spyOn(connection, 'reconnect').mockResolvedValue(undefined);

            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            /**
             * @param {number} delay
             * @param {() => void} [request]
             */
            const expectRetryAfter = (delay, request = () => connection.requestReconnect()) => {
                reconnect.mockClear();
                connection.status = Strophe.Status.CONNFAIL;
                request();
                vi.advanceTimersByTime(delay - 1);
                expect(reconnect).not.toHaveBeenCalled();
                vi.advanceTimersByTime(1);
                expect(reconnect).toHaveBeenCalledOnce();
            };
            try {
                [3000, 6000, 12000, 24000, 48000].forEach((delay) => expectRetryAfter(delay));

                // A retry is scheduled a minute from now, when the network comes back.
                connection.status = Strophe.Status.CONNFAIL;
                connection.requestReconnect();
                expectRetryAfter(3000, () => _converse.api.connection.retry());
                expectRetryAfter(6000);
            } finally {
                vi.useRealTimers();
            }
        }),
    );

    it(
        'checks a working connection with a ping, rather than replacing it',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const reconnect = vi.spyOn(connection, 'reconnect').mockResolvedValue(undefined);
            const ping = vi.spyOn(api, 'ping').mockResolvedValue(true);
            expect(connection.status).toBe(Strophe.Status.CONNECTED);

            await api.connection.retry();
            expect(ping).toHaveBeenCalledOnce();
            expect(reconnect).not.toHaveBeenCalled();
        }),
    );

    it(
        'does nothing before logging in',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            await runFirstSession(_converse);
            await api.user.logout();
            await reloadOffline(_converse);
            // The login form is shown.
            const connection = api.connection.get();
            expect(connection).toBeDefined();
            const reconnect = vi.spyOn(connection, 'reconnect').mockResolvedValue(undefined);

            await api.connection.retry();
            expect(reconnect).not.toHaveBeenCalled();
            expect(state.connfeedback.get('connection_status')).not.toBe(Strophe.Status.RECONNECTING);
        }),
    );

    it(
        'starts an attempt that was underway anew, once, and retries soon if that fails',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const connection = _converse.api.connection.get();
            const reconnect = vi.spyOn(connection, 'reconnect').mockResolvedValue(undefined);

            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                // A first attempt, and then a retry, each made while the network
                // was down, once the waits have grown long.
                for (const reconnecting of [undefined, true]) {
                    for (let i = 0; i < 5; i++) {
                        connection.setConnectionStatus(Strophe.Status.CONNFAIL);
                        connection.requestReconnect();
                        vi.runOnlyPendingTimers();
                    }
                    reconnect.mockClear();
                    connection.reconnecting = reconnecting;
                    connection.setConnectionStatus(Strophe.Status.CONNECTING);
                    // Left by the attempt underway, which mustn't answer the new one's challenge.
                    const challenge = connection.addHandler(() => true, Strophe.NS.SASL, 'challenge');

                    _converse.api.connection.retry();
                    expect(reconnect).toHaveBeenCalledOnce();
                    expect([...connection.handlers, ...connection.addHandlers]).not.toContain(challenge);
                    // Asked again, for example also on coming to the foreground.
                    _converse.api.connection.retry();
                    expect(reconnect).toHaveBeenCalledOnce();

                    // The new attempt fails.
                    connection.setConnectionStatus(Strophe.Status.CONNFAIL);
                    connection.requestReconnect();
                    vi.advanceTimersByTime(3000);
                    expect(reconnect).toHaveBeenCalledTimes(2);
                }
            } finally {
                vi.useRealTimers();
                delete connection.reconnecting;
            }
        }),
    );

    it(
        'starts an attempt anew after the one it started was disconnected',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const reconnect = vi.spyOn(connection, 'reconnect').mockResolvedValue(undefined);
            vi.spyOn(connection, 'requestReconnect').mockImplementation(() => {});

            connection.setConnectionStatus(Strophe.Status.CONNECTING);
            api.connection.retry();
            expect(reconnect).toHaveBeenCalledOnce();

            // For example, the socket closed before authenticating.
            connection.onConnectStatusChanged(Strophe.Status.DISCONNECTED);
            // The next attempt hangs on a network that's down again.
            connection.setConnectionStatus(Strophe.Status.CONNECTING);
            api.connection.retry();
            expect(reconnect).toHaveBeenCalledTimes(2);
        }),
    );

    it(
        'works without the ping plugin',
        mock.initConverse(converse, [], { blacklisted_plugins: ['converse-ping'] }, async (_converse) => {
            const { api } = _converse;
            // Left on the shared API by earlier tests that loaded the plugin.
            const ping = vi.spyOn(api, 'ping').mockResolvedValue(true);
            expect(api.connection.get().status).toBe(Strophe.Status.CONNECTED);

            await api.connection.retry();
            expect(ping).not.toHaveBeenCalled();
        }),
    );
});

describe('The rooms of a resumed session', function () {
    const lounge = 'lounge@montague.lit';
    const garden = 'garden@montague.lit';
    // Without MAM, so that no archive query from the first session is still
    // waiting for an answer when the page is reloaded.
    const features = mock.default_muc_features.filter((f) => f !== Strophe.NS.MAM);

    /**
     * @param {any} connection
     * @param {string} muc_jid
     */
    const joinPresences = (connection, muc_jid) =>
        connection.sent_stanzas.filter(
            (s) =>
                s.nodeName === 'presence' &&
                s.getAttribute('to') === `${muc_jid}/romeo` &&
                sizzle(`x[xmlns="${Strophe.NS.MUC}"]`, s).length,
        );

    /**
     * Answers the self-ping that checks whether we're still in a room.
     * @param {any} _converse
     * @param {string} muc_jid
     * @param {boolean} joined
     */
    async function answerSelfPing(_converse, muc_jid, joined) {
        const connection = _converse.api.connection.get();
        const ping = await u.waitUntil(() =>
            connection.IQ_stanzas.find(
                (iq) =>
                    iq.getAttribute('to') === `${muc_jid}/romeo` &&
                    sizzle(`ping[xmlns="${Strophe.NS.PING}"]`, iq).length,
            ),
        );
        connection._dataRecv(
            mock.createRequest(
                _converse,
                joined
                    ? stx`<iq type="result" id="${ping.getAttribute('id')}" from="${muc_jid}/romeo" to="${connection.jid}" xmlns="jabber:client"/>`
                    : stx`<iq type="error" id="${ping.getAttribute('id')}" from="${muc_jid}/romeo" to="${connection.jid}" xmlns="jabber:client">
                            <error type="cancel"><not-acceptable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
                          </iq>`,
            ),
        );
    }

    it(
        'are readable offline, and each is joined once on connecting',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);
            const muc = await mock.openAndEnterMUC(_converse, lounge, 'romeo', features);
            await muc.messages.create({ body: 'Hello all', type: 'groupchat', nick: 'juliet', msgid: 'm1' });

            const goOnline = await reloadOffline(_converse);
            const connection = api.connection.get();
            const room = await api.rooms.get(lounge);
            await room.initialized;
            expect(room.session.get('connection_status')).toBe(converse.ROOMSTATUS.OFFLINE);
            expect(room.messages.findWhere({ msgid: 'm1' }).get('body')).toBe('Hello all');
            expect(connection.sent_stanzas.length).toBe(0);

            await goOnline();
            await answerSelfPing(_converse, lounge, false);
            await mock.waitForMUCDiscoInfo(_converse, lounge, features);
            await u.waitUntil(() => joinPresences(connection, lounge).length === 1);
            expect(await api.rooms.get(lounge)).toBe(room);

            await mock.receiveOwnMUCPresence(_converse, lounge, 'romeo');
            await u.waitUntil(() => room.session.get('connection_status') === converse.ROOMSTATUS.ENTERED);
        }),
    );

    it(
        'are restored rather than joined when the server still has us in them',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { clear_messages_on_reconnection: true },
            async (_converse) => {
                const { api } = _converse;
                await runFirstSession(_converse);
                const muc = await mock.openAndEnterMUC(_converse, lounge, 'romeo', features);
                await muc.messages.create({ body: 'Hello all', type: 'groupchat', nick: 'juliet', msgid: 'm1' });

                const goOnline = await reloadOffline(_converse, { clear_messages_on_reconnection: true });
                const connection = api.connection.get();
                const room = await api.rooms.get(lounge);
                await room.initialized;
                /** @type {number[]} */
                const statuses = [];
                room.session.on('change:connection_status', () => statuses.push(room.session.get('connection_status')));
                const trigger = vi.spyOn(api, 'trigger');

                await goOnline();
                await answerSelfPing(_converse, lounge, true);
                await u.waitUntil(() => room.session.get('connection_status') === converse.ROOMSTATUS.ENTERED);
                expect(joinPresences(connection, lounge).length).toBe(0);

                // Announced, so that views showing it as offline are updated,
                // but only once the server has confirmed we're still in it.
                expect(statuses).toEqual([converse.ROOMSTATUS.ENTERED]);
                // It isn't treated as entered anew.
                expect(countEvents(trigger, 'enteredNewRoom')).toBe(0);
                expect(room.messages.findWhere({ msgid: 'm1' })).toBeDefined();
            },
        ),
    );

    it(
        'go back to Room Activity Indicators if they are hidden',
        mock.initConverse(converse, ['chatBoxesFetched'], { muc_subscribe_to_rai: true }, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);
            const muc = await mock.openAndEnterMUC(_converse, lounge, 'romeo', features);
            // Hidden in another tab, say, without having left it yet in this one.
            muc.save({ hidden: true }, { silent: true });

            const goOnline = await reloadOffline(_converse, { muc_subscribe_to_rai: true });
            const connection = api.connection.get();
            const room = await api.rooms.get(lounge);
            await room.initialized;
            expect(room.session.get('connection_status')).toBe(converse.ROOMSTATUS.OFFLINE);

            await goOnline();
            const rai = await u.waitUntil(() =>
                connection.sent_stanzas.find(
                    (s) =>
                        s.getAttribute('to') === 'montague.lit' && sizzle(`rai[xmlns="${Strophe.NS.RAI}"]`, s).length,
                ),
            );
            expect(rai).toBeDefined();
            expect(joinPresences(connection, lounge).length).toBe(0);
        }),
    );

    it(
        'include one opened while offline, which is joined on connecting, and not before logging in',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);

            const goOnline = await reloadOffline(_converse);
            const connection = api.connection.get();
            // The stream is open, but we haven't logged in yet.
            connection.connected = true;
            const room = await api.rooms.open(garden, { nick: 'romeo' });
            await room.initialized;
            expect(room.session.get('connection_status')).toBe(converse.ROOMSTATUS.OFFLINE);
            await room.join();
            expect(connection.sent_stanzas.length).toBe(0);
            expect(connection.IQ_stanzas.length).toBe(0);

            connection.connected = false;
            await goOnline();
            await mock.waitForMUCDiscoInfo(_converse, garden, features);
            await u.waitUntil(() => joinPresences(connection, garden).length === 1);
        }),
    );

    it(
        'include one still being opened when the connection comes up',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);
            const goOnline = await reloadOffline(_converse);
            const connection = api.connection.get();

            // Its cache is still being read when the connection comes up.
            const { MUC } = _converse.exports;
            const loadOffline = MUC.prototype.loadOffline;
            let release;
            const held = new Promise((resolve) => (release = resolve));
            const spy = vi.spyOn(MUC.prototype, 'loadOffline').mockImplementation(async function () {
                await held;
                return loadOffline.call(this);
            });
            const opening = api.rooms.open(garden, { nick: 'romeo' });
            await u.waitUntil(() => spy.mock.calls.length === 1);

            await goOnline();
            await u.waitUntil(() => api.connection.authenticated());
            release();
            spy.mockRestore();

            await mock.waitForMUCDiscoInfo(_converse, garden, features);
            await u.waitUntil(() => joinPresences(connection, garden).length === 1);
            await opening;
        }),
    );

    it(
        "aren't entered when closed",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);
            const muc = await mock.openAndEnterMUC(_converse, lounge, 'romeo', features);
            // For example, a resized room in the overlayed view that was closed.
            await new Promise((success) => muc.save({ closed: true }, { success }));

            await reloadOffline(_converse);
            const room = await api.rooms.get(lounge);
            await expect(room.enterIfOffline()).resolves.toBeUndefined();
        }),
    );
});

describe('The chats of a resumed session', function () {
    /**
     * @param {any} connection
     */
    const archiveQueries = (connection) =>
        connection.IQ_stanzas.filter((iq) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, iq).length);

    it(
        'catch up from the archive once on connecting, and keep what was read',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);

            const goOnline = await reloadOffline(_converse, { clear_messages_on_reconnection: true });
            const connection = api.connection.get();
            const chat = await api.chats.get(contact_jid);
            const message = chat.messages.findWhere({ msgid: 'msg1' });
            expect(archiveQueries(connection).length).toBe(0);

            await goOnline();
            await mock.waitUntilDiscoConfirmed(_converse, 'romeo@montague.lit', null, [Strophe.NS.MAM]);
            const query = await u.waitUntil(() => archiveQueries(connection).pop());
            expect(sizzle(`field[var="with"] value`, query).pop().textContent).toBe(contact_jid);

            // Give a second query a chance to go out.
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(archiveQueries(connection).length).toBe(1);

            // Connecting after a resume isn't a reconnection.
            expect(chat.messages.findWhere({ msgid: 'msg1' })).toBe(message);
        }),
    );

    it(
        "don't hold up the rest when they can't be read from the cache",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);

            const fetch = _converse.exports.ChatBoxes.prototype.fetch;
            vi.spyOn(_converse.exports.ChatBoxes.prototype, 'fetch').mockImplementationOnce(function (options) {
                options.error(this, new Error('The chats store is broken'));
            });
            const goOnline = await reloadOffline(_converse);
            expect((await api.contacts.get(contact_jid)).get('subscription')).toBe('both');
            expect(await api.user.status.message.get()).toBe('On a train');

            _converse.exports.ChatBoxes.prototype.fetch = fetch;
            await goOnline();
            // Read once connected instead.
            const chat = await api.chats.get(contact_jid);
            await u.waitUntil(() => chat.messages.findWhere({ msgid: 'msg1' }));
        }),
    );
});

describe('The roster and profile of a resumed session', function () {
    it(
        'are read once connected if they could not be read from the cache',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await runFirstSession(_converse);

            const { RosterContacts, Profile } = _converse.exports;
            vi.spyOn(RosterContacts.prototype, 'fetchCachedContacts').mockRejectedValueOnce(
                new Error('The roster store is broken'),
            );
            const fetch = Profile.prototype.fetch;
            vi.spyOn(Profile.prototype, 'fetch').mockImplementationOnce(function (options) {
                options.error(this, new Error('The profile store is broken'));
            });
            const goOnline = await reloadOffline(_converse);
            Profile.prototype.fetch = fetch;

            await goOnline();
            await api.waitUntil('statusInitialized');
            expect(await api.user.status.message.get()).toBe('On a train');
            await api.waitUntil('rosterContactsFetched');
            expect((await api.contacts.get(contact_jid)).get('subscription')).toBe('both');
        }),
    );
});
