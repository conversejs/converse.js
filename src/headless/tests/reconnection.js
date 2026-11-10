import mock from '../tests/mock.js';
import converse from '../dist/converse-headless.js';

const { Strophe, u } = converse.env;

/**
 * @param {any} connection
 */
function spyOnOutcomes(connection) {
    return {
        finish: vi.spyOn(connection, 'finishDisconnection').mockResolvedValue(undefined),
        reconnect: vi.spyOn(connection, 'requestReconnect').mockImplementation(() => {}),
    };
}

describe('A connection that fails', function () {
    it(
        'keeps retrying when a retry dies before login has finished',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const { finish, reconnect } = spyOnOutcomes(connection);

            connection.reconnecting = true;
            connection.status = Strophe.Status.CONNECTING;
            connection.onDisconnected();

            expect(finish).not.toHaveBeenCalled();
            expect(reconnect).toHaveBeenCalledOnce();
            delete connection.reconnecting;
        }),
    );

    it(
        'gives up if it was never established',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const { finish, reconnect } = spyOnOutcomes(connection);
            connection.has_connected = false;

            connection.status = Strophe.Status.CONNECTING;
            connection.onDisconnected();
            expect(finish).toHaveBeenCalledTimes(1);

            // One retry after a failure, which may use the other transport, and no more.
            connection.status = Strophe.Status.CONNFAIL;
            connection.onDisconnected();
            expect(finish).toHaveBeenCalledTimes(1);
            expect(reconnect).toHaveBeenCalledTimes(1);

            connection.reconnecting = true;
            connection.onDisconnected();
            expect(finish).toHaveBeenCalledTimes(2);
            expect(reconnect).toHaveBeenCalledTimes(1);

            delete connection.reconnecting;
            connection.has_connected = true;
        }),
    );

    it(
        'ignores further reports of being disconnected once it has been given up on',
        mock.initConverse(converse, ['discoInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const finish = vi.spyOn(connection, 'finishDisconnection');
            const retry = vi.spyOn(connection, 'reconnect').mockResolvedValue(undefined);
            connection.has_connected = false;
            connection.status = Strophe.Status.CONNECTING;

            // A retry that's still scheduled is cancelled too.
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            connection.status = Strophe.Status.CONNFAIL;
            connection.requestReconnect();
            connection.status = Strophe.Status.CONNECTING;
            const reconnect = vi.spyOn(connection, 'requestReconnect').mockImplementation(() => {});
            connection.onDisconnected();
            connection.onDisconnected();
            vi.advanceTimersByTime(3000);
            vi.useRealTimers();

            expect(finish).toHaveBeenCalledOnce();
            expect(reconnect).not.toHaveBeenCalled();
            expect(retry).not.toHaveBeenCalled();
            await u.waitUntil(() => !api.connection.get());
        }),
    );

    it(
        'waits twice as long before each retry, up to a minute, until it comes up',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const connection = _converse.api.connection.get();
            const reconnect = vi.spyOn(connection, 'reconnect').mockResolvedValue(undefined);
            vi.spyOn(connection, 'onConnected').mockResolvedValue(undefined);

            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            const expectRetryAfter = (delay) => {
                reconnect.mockClear();
                connection.status = Strophe.Status.CONNFAIL;
                connection.requestReconnect();
                vi.advanceTimersByTime(delay - 1);
                expect(reconnect).not.toHaveBeenCalled();
                // Reports that arrive during the wait don't change it.
                connection.requestReconnect();
                vi.advanceTimersByTime(1);
                expect(reconnect).toHaveBeenCalledOnce();
            };
            try {
                [3000, 6000, 12000, 24000, 48000, 60000, 60000].forEach(expectRetryAfter);

                connection.onConnectStatusChanged(Strophe.Status.CONNECTED);
                expectRetryAfter(3000);
            } finally {
                vi.useRealTimers();
            }
        }),
    );

    it(
        'keeps retrying if it was never established, when configured to',
        mock.initConverse(converse, [], { retry_initial_connection: true }, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const { finish, reconnect } = spyOnOutcomes(connection);
            connection.has_connected = false;

            connection.reconnecting = true;
            connection.status = Strophe.Status.CONNECTING;
            connection.onDisconnected();

            expect(finish).not.toHaveBeenCalled();
            expect(reconnect).toHaveBeenCalledOnce();
            delete connection.reconnecting;
            connection.has_connected = true;
        }),
    );

    it(
        'keeps retrying through a remote connection failure, when configured to',
        mock.initConverse(converse, [], { retry_initial_connection: true }, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const { finish, reconnect } = spyOnOutcomes(connection);
            connection.has_connected = false;
            connection.status = Strophe.Status.CONNFAIL;

            connection.setDisconnectionCause(Strophe.Status.CONNFAIL, 'remote-connection-failed', true);
            connection.onDisconnected();
            expect(finish).not.toHaveBeenCalled();
            expect(reconnect).toHaveBeenCalledOnce();

            // An error that retrying can't fix still stops it.
            connection.setDisconnectionCause(Strophe.Status.CONNFAIL, 'host-unknown', true);
            connection.onDisconnected();
            expect(finish).toHaveBeenCalledOnce();
            expect(reconnect).toHaveBeenCalledOnce();

            // Once established, the setting no longer applies.
            connection.has_connected = true;
            connection.setDisconnectionCause(Strophe.Status.CONNFAIL, 'remote-connection-failed', true);
            connection.onDisconnected();
            expect(finish).toHaveBeenCalledTimes(2);
            expect(reconnect).toHaveBeenCalledOnce();
            connection.setDisconnectionCause();
        }),
    );

    it(
        'stops on a remote connection failure by default',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const { finish, reconnect } = spyOnOutcomes(connection);
            connection.has_connected = false;
            connection.status = Strophe.Status.CONNFAIL;

            connection.setDisconnectionCause(Strophe.Status.CONNFAIL, 'remote-connection-failed', true);
            connection.onDisconnected();

            expect(finish).toHaveBeenCalledOnce();
            expect(reconnect).not.toHaveBeenCalled();
            connection.setDisconnectionCause();
            connection.has_connected = true;
        }),
    );

    it(
        'uses the other transport for the attempt after a failure',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const switchTransport = vi.spyOn(connection, 'switchTransport').mockResolvedValue(undefined);
            vi.spyOn(api.user, 'login').mockResolvedValue(undefined);

            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                connection.onConnectStatusChanged(Strophe.Status.CONNFAIL, 'connection failed');
                // The status that's reported to the user no longer says the attempt failed.
                connection.requestReconnect();
                expect(_converse.state.connfeedback.get('connection_status')).toBe(Strophe.Status.RECONNECTING);
                vi.advanceTimersByTime(3000);
            } finally {
                vi.useRealTimers();
            }
            await u.waitUntil(() => switchTransport.mock.calls.length === 1);

            await connection.reconnect();
            expect(switchTransport).toHaveBeenCalledOnce();

            connection.setDisconnectionCause();
            delete connection.reconnecting;
            connection.status = Strophe.Status.CONNECTED;
        }),
    );

    it(
        'waits before retrying after a failed attempt, but not after losing a working connection',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const reconnect = vi.spyOn(connection, 'reconnect').mockResolvedValue(undefined);

            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                connection.status = Strophe.Status.CONNFAIL;
                api.connection.reconnect();
                expect(reconnect).not.toHaveBeenCalled();

                // Another report of the same failure doesn't start an attempt either.
                api.connection.reconnect();
                expect(reconnect).not.toHaveBeenCalled();

                vi.advanceTimersByTime(3000);
                expect(reconnect).toHaveBeenCalledOnce();
                reconnect.mockClear();

                connection.status = Strophe.Status.CONNECTED;
                api.connection.reconnect();
                expect(reconnect).toHaveBeenCalledOnce();
            } finally {
                vi.useRealTimers();
            }
            connection.status = Strophe.Status.CONNECTED;
        }),
    );

    it(
        'brings a long wait forward when a reconnection is asked for, and keeps backing off',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const reconnect = vi.spyOn(connection, 'reconnect').mockResolvedValue(undefined);

            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                for (const delay of [3000, 6000, 12000]) {
                    connection.status = Strophe.Status.CONNFAIL;
                    connection.requestReconnect();
                    vi.advanceTimersByTime(delay);
                }
                reconnect.mockClear();

                // The next retry would be in 24 seconds.
                connection.status = Strophe.Status.CONNFAIL;
                connection.requestReconnect();
                api.connection.reconnect();
                vi.advanceTimersByTime(2999);
                expect(reconnect).not.toHaveBeenCalled();
                vi.advanceTimersByTime(1);
                expect(reconnect).toHaveBeenCalledOnce();
                reconnect.mockClear();

                // That didn't count as another step of the backoff.
                connection.requestReconnect();
                vi.advanceTimersByTime(47999);
                expect(reconnect).not.toHaveBeenCalled();
                vi.advanceTimersByTime(1);
                expect(reconnect).toHaveBeenCalledOnce();
            } finally {
                vi.useRealTimers();
            }
            connection.status = Strophe.Status.CONNECTED;
        }),
    );

    it(
        'leaves an attempt that is underway alone when a reconnection is asked for',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const reconnect = vi.spyOn(connection, 'reconnect').mockResolvedValue(undefined);

            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                connection.reconnecting = true;
                connection.status = Strophe.Status.CONNECTING;
                api.connection.reconnect();
                vi.advanceTimersByTime(60000);
                expect(reconnect).not.toHaveBeenCalled();
                expect(connection.status).toBe(Strophe.Status.CONNECTING);

                // The attempt failing does lead to another one.
                connection.requestReconnect();
                vi.advanceTimersByTime(3000);
                expect(reconnect).toHaveBeenCalledOnce();
            } finally {
                vi.useRealTimers();
            }
            delete connection.reconnecting;
            connection.status = Strophe.Status.CONNECTED;
        }),
    );

    it(
        'leaves a retry that is getting ready to log in alone when a reconnection is asked for',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            let finishLogin;
            const login = vi.spyOn(api.user, 'login').mockReturnValue(new Promise((f) => (finishLogin = f)));

            const retry = connection.reconnect();
            await u.waitUntil(() => login.mock.calls.length === 1);

            connection.setConnectionStatus(Strophe.Status.DISCONNECTED);
            api.connection.reconnect();
            expect(connection.status).toBe(Strophe.Status.DISCONNECTED);

            finishLogin();
            await retry;
            delete connection.reconnecting;
            connection.status = Strophe.Status.CONNECTED;
        }),
    );

    it(
        'retries a connection that never came up once, through the real retry, and then gives up',
        mock.initConverse(converse, ['discoInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const finish = vi.spyOn(connection, 'finishDisconnection');
            const login = vi.spyOn(api.user, 'login').mockResolvedValue(undefined);
            vi.spyOn(connection, 'switchTransport').mockResolvedValue(undefined);
            connection.has_connected = false;

            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                connection.onConnectStatusChanged(Strophe.Status.CONNFAIL, 'connection failed');
                connection.onConnectStatusChanged(Strophe.Status.DISCONNECTED);
                expect(login).not.toHaveBeenCalled();
                vi.advanceTimersByTime(3000);
            } finally {
                vi.useRealTimers();
            }
            await u.waitUntil(() => login.mock.calls.length === 1);
            expect(finish).not.toHaveBeenCalled();

            // The retry fails too.
            connection.onConnectStatusChanged(Strophe.Status.CONNECTING);
            connection.onConnectStatusChanged(Strophe.Status.CONNFAIL, 'connection failed');
            connection.onConnectStatusChanged(Strophe.Status.DISCONNECTED);

            expect(finish).toHaveBeenCalledOnce();
            expect(login).toHaveBeenCalledOnce();
            await u.waitUntil(() => !api.connection.get());
        }),
    );

    it(
        'does not log in again if it is given up on while a retry is getting ready',
        mock.initConverse(converse, ['discoInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const login = vi.spyOn(api.user, 'login').mockResolvedValue(undefined);

            const retry = connection.reconnect();
            const finished = connection.finishDisconnection();
            await Promise.all([retry, finished]);

            expect(login).not.toHaveBeenCalled();
            expect(api.connection.get()).toBeUndefined();
        }),
    );

    it(
        'does nothing if the connection has gone by the time credentials arrive',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            api.listen.on('beforeAttemptNonPreboundSession', (_context, payload) => {
                api.connection.destroy();
                return { ...payload, credentials: { password: 'secret' } };
            });

            await expect(api.user.login('romeo@montague.lit', 'secret')).resolves.toBeUndefined();
            expect(api.connection.get()).toBeUndefined();
        }),
    );
});

describe('A connection that comes up', function () {
    it(
        'counts as the first one if only a retry got it there',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const connection = api.connection.get();
            const onConnected = vi.spyOn(connection, 'onConnected').mockResolvedValue(undefined);

            connection.has_connected = false;
            connection.reconnecting = true;
            connection.onConnectStatusChanged(Strophe.Status.CONNECTED);
            expect(onConnected).toHaveBeenLastCalledWith();

            connection.reconnecting = true;
            connection.onConnectStatusChanged(Strophe.Status.CONNECTED);
            expect(onConnected).toHaveBeenLastCalledWith(true);
            delete connection.reconnecting;
        }),
    );
});
