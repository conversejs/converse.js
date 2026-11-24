import converse from '../../../dist/converse-headless.js';
import mock from '../../../tests/mock.js';

/**
 * Records what each connection is asked to connect with, without connecting.
 * @param {any} api
 * @returns {Array<{ jid: string, password: string }>}
 */
function recordConnects(api) {
    const connects = [];
    const init = api.connection.init;
    vi.spyOn(api.connection, 'init').mockImplementation(function (...args) {
        const connection = init.apply(this, args);
        vi.spyOn(connection, 'connect').mockImplementation((jid, password) => connects.push({ jid, password }));
        return connection;
    });
    return connects;
}

describe("The browser's credential store", function () {
    afterEach(() => localStorage.removeItem('conversejs-session-jid'));

    it(
        'logs in with the password it stores, once Converse has none of its own',
        mock.initConverse(converse, [], { auto_login: false, keepalive: false }, async (_converse) => {
            const { api } = _converse;
            vi.spyOn(navigator.credentials, 'get').mockResolvedValue(
                /** @type {any} */ ({ type: 'password', id: 'juliet@montague.lit', password: 'stored' }),
            );
            const connects = recordConnects(api);
            // An account that logged in on this device before
            localStorage.setItem('conversejs-session-jid', 'juliet@montague.lit');

            await api.user.login();

            expect(navigator.credentials.get).toHaveBeenCalledWith({ password: true });
            expect(_converse.session.get('bare_jid')).toBe('juliet@montague.lit');
            expect(connects).toEqual([{ jid: _converse.session.get('jid'), password: 'stored' }]);
        }),
    );
});
