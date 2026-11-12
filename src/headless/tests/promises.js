import mock from '../tests/mock.js';
import converse from '../dist/converse-headless.js';

/**
 * Whether the promise is resolved within a short wait.
 * @param {Promise<any>} promise
 * @returns {Promise<boolean>}
 */
function isResolvedSoon(promise) {
    return Promise.race([promise.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 100))]);
}

describe('Renewing a promise (api.promises.renew)', function () {
    it(
        'keeps one that is still pending, so that what waits on it is told',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            api.promises.add('somethingDone');
            const waiting = api.waitUntil('somethingDone');

            api.promises.renew('somethingDone');
            api.trigger('somethingDone');
            expect(await isResolvedSoon(waiting)).toBe(true);
        }),
    );

    it(
        'makes a new one once the old one is resolved',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            api.promises.add('somethingDone', false);
            api.trigger('somethingDone');
            const resolved = api.waitUntil('somethingDone');
            await resolved;

            api.promises.renew('somethingDone');
            const renewed = api.waitUntil('somethingDone');
            expect(renewed).not.toBe(resolved);
            expect(renewed.isPending).toBe(true);
            expect(renewed.replace).toBe(false);
        }),
    );
});

describe('Adding a promise again (api.promises.add)', function () {
    it(
        'replaces one that is still pending, without telling what waits on it',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            api.promises.add('somethingDone');
            const waiting = api.waitUntil('somethingDone');

            api.promises.add('somethingDone');
            api.trigger('somethingDone');
            expect(await isResolvedSoon(waiting)).toBe(false);
            expect(waiting.isPending).toBe(true);
        }),
    );
});
