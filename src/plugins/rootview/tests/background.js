import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const u = converse.env.utils;

describe('Converse Background Theme', function() {
    it(
        'clears old theme class and applies only the new one when theme changes',
        mock.initConverse(converse, [], {
                show_background: true,
                theme: 'nordic',
                dark_theme: 'nordic'
            },
            async (_converse) => {
                const { api } = _converse;

                await u.waitUntil(() => document.querySelector('converse-bg'));
                const bg = document.querySelector('converse-bg');

                await u.waitUntil(() => bg.classList.contains('theme-nordic'), 1000);
                let bgClassList = Array.from(bg.classList).filter((c) => c.startsWith('theme-'));
                expect(bgClassList).toEqual(['theme-nordic']);

                api.settings.set('theme', 'dracula');
                api.settings.set('dark_theme', 'dracula');
                bg.setThemeAttributes();

                bgClassList = Array.from(bg.classList).filter((c) => c.startsWith('theme-'));
                expect(bgClassList).toEqual(['theme-dracula']);
            }
        )
    );
});
