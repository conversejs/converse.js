import converse from '../../../dist/converse-headless.js';
import mock from '../../../tests/mock.js';

describe('A prebound BOSH session', function () {
    afterEach(() => vi.unstubAllGlobals());

    it(
        'is given up on, rather than retried, when the prebind_url fails',
        mock.initConverse(
            converse,
            [],
            { authentication: 'prebind', auto_login: false, prebind_url: '/prebind' },
            async (_converse) => {
                const { api } = _converse;
                let reconnect;
                const send = vi.fn(function () {
                    // The connection only exists once logging in has started.
                    reconnect = vi.spyOn(api.connection.get(), 'requestReconnect').mockImplementation(() => {});
                    this.status = 401;
                    this.onload();
                });
                vi.stubGlobal(
                    'XMLHttpRequest',
                    class {
                        open() {}
                        setRequestHeader() {}
                        send = send;
                    },
                );
                const failed = new Promise((resolve) => api.listen.once('noResumeableBOSHSession', resolve));

                await api.user.login();
                await failed;

                expect(send).toHaveBeenCalledOnce();
                expect(reconnect).not.toHaveBeenCalled();
                expect(api.connection.get()).toBeUndefined();
            },
        ),
    );

    it(
        'is reported at login to need a BOSH URL',
        mock.initConverse(converse, [], { auto_login: false }, async (_converse) => {
            await converse.initialize({
                auto_login: false,
                keepalive: false,
                authentication: 'prebind',
                websocket_url: 'wss://montague.lit/ws',
            });
            await expect(_converse.api.user.login('romeo@montague.lit')).rejects.toThrow(
                "authentication is set to 'prebind'",
            );
        }),
    );

    it(
        'is reported at login to need the converse-bosh plugin',
        mock.initConverse(converse, [], { auto_login: false }, async (_converse) => {
            await converse.initialize({
                auto_login: false,
                keepalive: false,
                authentication: 'prebind',
                blacklisted_plugins: ['converse-bosh'],
            });
            await expect(_converse.api.user.login('romeo@montague.lit')).rejects.toThrow(
                "the converse-bosh plugin isn't loaded",
            );
        }),
    );
});
