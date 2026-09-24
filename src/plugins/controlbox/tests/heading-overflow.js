import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('A controlbox section heading', function () {
    it(
        'truncates instead of painting over its dropdown',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);

            const heading = await u.waitUntil(() =>
                document.querySelector('#controlbox .controlbox-heading--contacts')
            );
            const dropdown = heading.parentElement.querySelector('converse-dropdown');
            expect(dropdown).toBeTruthy();

            // The heading grows into leftover space rather than claiming the row,
            // so the dropdown keeps its place.
            expect(heading.getBoundingClientRect().right).toBeLessThanOrEqual(
                dropdown.getBoundingClientRect().left + 0.5
            );

            // `min-width: 0` lets it shrink past its own text, and these headings
            // are a single word in most locales, so there is nowhere to wrap.
            // Without clipping the text paints straight over the dropdown.
            const styles = window.getComputedStyle(heading);
            expect(styles.whiteSpace).toBe('nowrap');
            expect(styles.overflow).not.toBe('visible');
            expect(styles.textOverflow).toBe('ellipsis');

            // A long translation is the real trigger, but the text node belongs
            // to Lit and rewriting it ejects the template's marker nodes. Widening
            // the glyphs reproduces the same condition (text wider than the box)
            // without reaching into rendered DOM.
            const one_line = Math.round(heading.getBoundingClientRect().height);
            heading.style.letterSpacing = '60px';
            await u.waitUntil(() => heading.scrollWidth > heading.clientWidth);

            // Truncated on one line, still clear of the dropdown.
            expect(Math.round(heading.getBoundingClientRect().height)).toBe(one_line);
            expect(heading.getBoundingClientRect().right).toBeLessThanOrEqual(
                dropdown.getBoundingClientRect().left + 0.5
            );
            expect(dropdown.getBoundingClientRect().right).toBeLessThanOrEqual(
                document.querySelector('#controlbox').getBoundingClientRect().right + 0.5
            );
        }),
    );
});
