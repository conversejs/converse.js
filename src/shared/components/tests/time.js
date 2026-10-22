import { vi } from 'vitest';
import mock from '../../tests/mock.js';
import converse from '../../../../dist/converse.js';

describe('The converse-time element', function () {
    afterEach(() => vi.useRealTimers());

    it(
        'keeps refreshing a recent timestamp that replaced an old one',
        mock.initConverse(converse, [], {}, async function () {
            vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
            const now = new Date('2024-01-10T12:00:00Z');
            vi.setSystemTime(now);

            const el = document.createElement('converse-time');
            el.setAttribute('timestamp', '2024-01-01T12:00:00Z');
            document.body.appendChild(el);
            await el.updateComplete;

            // E.g. a /me message from last week that has just been retracted
            el.setAttribute('timestamp', now.toISOString());
            await el.updateComplete;
            expect(el.textContent.trim()).toBe('now');

            vi.advanceTimersByTime(5 * 60 * 1000);
            await el.updateComplete;
            expect(el.textContent.trim()).toBe('5m');

            el.remove();
        }),
    );
});
