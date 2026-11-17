import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

describe('A dropped connection', function () {
    it(
        'is retried at once when the network is back or the page comes to the foreground',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            mock.dropConnection(_converse);
            const connection = _converse.api.connection.get();
            const retry = vi.spyOn(connection, 'retry').mockImplementation(() => {});

            window.dispatchEvent(new Event('online'));
            expect(retry).toHaveBeenCalledTimes(1);

            const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
            document.dispatchEvent(new Event('visibilitychange'));
            expect(retry).toHaveBeenCalledTimes(1);

            visibility.mockReturnValue('visible');
            document.dispatchEvent(new Event('visibilitychange'));
            expect(retry).toHaveBeenCalledTimes(2);
        }),
    );
});
