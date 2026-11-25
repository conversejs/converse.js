import converse from '../../../dist/converse-headless.js';
import mock from '../../../tests/mock.js';

const { Strophe, u } = converse.env;

// Not logged in by itself at start-up, so that each spec logs in once.
const SETTINGS = { auto_login: false, keepalive: false, connection_options: { worker: '/worker.js' } };

/**
 * Stands in for the shared worker that holds the connection: the worker's
 * answer to an attach is fed in through `answerAttach`, and a `connect` goes
 * to the mock server instead of through the worker.
 * @param {any} api
 */
function stubWorker(api) {
    vi.stubGlobal(
        'SharedWorker',
        class {
            port = { start() {}, close() {}, postMessage() {}, addEventListener() {} };
        },
    );
    const calls = { connect: null };
    const init = api.connection.init;
    vi.spyOn(api.connection, 'init').mockImplementation(function (...args) {
        const connection = init.apply(this, args);
        calls.connect ??= vi.spyOn(connection, 'connect');
        return connection;
    });
    return calls;
}

/**
 * Answers the attach that the login sent to the worker, as the worker does.
 * @param {any} api
 * @param {number} status
 */
async function answerAttach(api, status) {
    await u.waitUntil(() => api.connection.get()?._proto.worker);
    api.connection.get()._proto._attachCallback(status, 'romeo@montague.lit/orchard');
}

describe('A shared worker session', function () {
    afterEach(() => vi.unstubAllGlobals());

    it(
        'is attached to at login, before anything else is done',
        mock.initConverse(converse, [], SETTINGS, async (_converse) => {
            const { api } = _converse;
            const calls = stubWorker(api);

            const login = api.user.login('romeo@montague.lit', 'secret');
            await answerAttach(api, Strophe.Status.ATTACHED);
            await login;

            expect(calls.connect).not.toHaveBeenCalled();
            expect(api.connection.authenticated()).toBe(true);
            expect(_converse.state.connfeedback.get('connection_status')).toBe(Strophe.Status.ATTACHED);
            expect(api.connection.get().hasResumed()).toBe(true);
        }),
    );

    it(
        'is connected anew when there is none to attach to',
        mock.initConverse(converse, [], SETTINGS, async (_converse) => {
            const { api } = _converse;
            const calls = stubWorker(api);

            const login = api.user.login('romeo@montague.lit', 'secret');
            await answerAttach(api, Strophe.Status.ATTACHFAIL);
            await login;
            await u.waitUntil(() => api.connection.authenticated());

            expect(calls.connect).toHaveBeenCalledOnce();
            expect(Strophe.getBareJidFromJid(calls.connect.mock.calls[0][0])).toBe('romeo@montague.lit');
            expect(api.connection.get().hasResumed()).toBe(false);
        }),
    );

    it(
        'is connected anew when the worker drops it while attaching',
        mock.initConverse(converse, [], SETTINGS, async (_converse) => {
            const { api } = _converse;
            const calls = stubWorker(api);
            const reconnect = vi.fn();
            api.listen.on('will-reconnect', reconnect);

            const login = api.user.login('romeo@montague.lit', 'secret');
            await u.waitUntil(() => api.connection.get()?._proto.worker);
            // As the worker does for a page from another build, or once its socket is gone.
            api.connection.get()._proto._onClose('Shared connection worker protocol mismatch');
            await login;
            await u.waitUntil(() => api.connection.authenticated());

            expect(calls.connect).toHaveBeenCalledOnce();
            expect(reconnect).not.toHaveBeenCalled();
        }),
    );

    it(
        'lets login finish when logging out while attaching',
        mock.initConverse(converse, [], SETTINGS, async (_converse) => {
            const { api } = _converse;
            const calls = stubWorker(api);

            const login = api.user.login('romeo@montague.lit', 'secret');
            await u.waitUntil(() => api.connection.get()?._proto.worker);
            await api.user.logout();
            await login;

            expect(calls.connect).not.toHaveBeenCalled();
            expect(api.connection.authenticated()).toBeFalsy();
        }),
    );

    it(
        'keeps its data where every tab can read it',
        mock.initConverse(converse, [], SETTINGS, async (_converse) => {
            const { api } = _converse;
            stubWorker(api);

            const login = api.user.login('romeo@montague.lit', 'secret');
            await answerAttach(api, Strophe.Status.ATTACHFAIL);
            await login;

            expect(_converse.session.storage.store).toBe(_converse.storage.persistent);
        }),
    );

    it(
        'is reported at login to need its plugin',
        mock.initConverse(
            converse,
            [],
            { ...SETTINGS, blacklisted_plugins: ['converse-shared-worker'] },
            async (_converse) => {
                await expect(_converse.api.user.login('romeo@montague.lit', 'secret')).rejects.toThrow(
                    "the converse-shared-worker plugin isn't loaded",
                );
                expect(_converse.session.get('jid')).toBeUndefined();
            },
        ),
    );
});

describe('A session without a shared worker', function () {
    it(
        'keeps its data to this tab',
        mock.initConverse(converse, [], { auto_login: false, keepalive: false }, async (_converse) => {
            const { api } = _converse;
            await api.user.login('romeo@montague.lit', 'secret');
            expect(_converse.session.storage.store).toBe(_converse.storage.session);
        }),
    );
});
