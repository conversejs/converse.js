import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

/**
 * The bundled themes each declare `color-scheme`, and `api.theme.isDark()`
 * reads it back off the DOM, so a theme Converse has never heard of is
 * answered for on the same terms. These specs drive it through the real
 * stylesheet rather than a stub, since the whole point is that the answer
 * comes from the CSS and not from a list of names.
 */
describe('The active theme', function () {
    /**
     * @param {string} theme
     * @param {boolean} is_dark
     */
    function itIsDark(theme, is_dark) {
        it(
            `is reported as ${is_dark ? 'dark' : 'light'} for the ${theme} theme`,
            mock.initConverse(converse, [], { theme }, async (_converse) => {
                const { api } = _converse;
                const root = document.querySelector('converse-root');
                expect(root.getAttribute('data-converse-theme')).toBe(theme);
                expect(getComputedStyle(root).colorScheme).toBe(is_dark ? 'dark' : 'light');
                expect(api.theme.get()).toBe(theme);
                expect(api.theme.isDark()).toBe(is_dark);
                // `color-scheme` inherits, so anything inside agrees.
                expect(api.theme.isDark(root.querySelector('converse-modals'))).toBe(is_dark);
            })
        );
    }

    itIsDark('classic', false);
    itIsDark('nordic', false);
    itIsDark('dracula', true);
    itIsDark('cyberpunk', true);

    it(
        'is taken to be light when the theme declares no color-scheme',
        mock.initConverse(converse, [], { theme: 'no-such-theme' }, async (_converse) => {
            const { api } = _converse;
            const root = document.querySelector('converse-root');
            expect(getComputedStyle(root).colorScheme).toBe('normal');
            expect(api.theme.isDark()).toBe(false);
        })
    );
});
