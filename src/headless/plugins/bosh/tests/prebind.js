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
});
