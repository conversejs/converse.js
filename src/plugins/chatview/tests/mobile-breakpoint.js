import { page } from '@vitest/browser/context';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

// The two halves of the full-page condition. `MOBILE_CUTOFF` and
// `MOBILE_LANDSCAPE_CUTOFF` in shared/constants.js, and
// `$mobile_portrait_length` and `$mobile_landscape_height` in
// shared/styles/_variables.scss, are the same two numbers.
const CUTOFF = 576;
const LANDSCAPE_CUTOFF = 450;

// Inside the band that used to be a seam: the JS called this mobile (its
// cutoff was 768) while the CSS still drew a floating desktop box (its cutoff
// was 480).
const SEAM = 640;

// Below the new cutoff but above the old SCSS one, so none of the mobile rules
// used to reach here either.
const NARROW = 520;

// Tall enough that the landscape half of the condition never fires, so every
// assertion is about width alone unless it says otherwise.
const TALL = 720;

// `dragresize` debounces its `resize` handler by 250ms. Only the spec that
// exercises that handler has to outlast it.
const DEBOUNCE = 400;

/**
 * Resizes the test iframe and waits for the resize to land.
 *
 * Deliberately does not also assert which side of a cutoff the media query
 * ended up on: `innerWidth` counts a scrollbar and the `width` media feature
 * does not, so demanding that both agree on the boundary pixel is a condition
 * that can never be satisfied. The specs below observe what the media query
 * did rather than predicting it.
 *
 * @param {number} width
 * @param {number} [height]
 */
async function setViewport(width, height = TALL) {
    await page.viewport(width, height);
    await u.waitUntil(() => window.innerWidth === width && window.innerHeight === height);
}

/**
 * Opens a chat and gives it stored dimensions, as a drag-resize would.
 * @param {any} _converse
 * @returns {Promise<HTMLElement>} the chat's flyout
 */
async function openResizedChat(_converse) {
    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    const view = _converse.chatboxviews.get(contact_jid);
    const flyout = await u.waitUntil(() => view.querySelector('.box-flyout'));
    await u.waitUntil(() => flyout.getBoundingClientRect().width > 0);

    view.model.save({ width: 420, height: 360 });
    view.requestUpdate();
    await view.updateComplete;
    return view.querySelector('.box-flyout');
}

/**
 * Whether the stylesheets are currently laying this element out as the whole
 * page rather than as a floating box. Square corners are what says so.
 * @param {HTMLElement} flyout
 */
function cssSaysFullPage(flyout) {
    return getComputedStyle(flyout).borderTopLeftRadius === '0px';
}

describe('The mobile breakpoint', function () {
    it(
        'keeps the JS and the stylesheets agreed at every width, including the boundary pixel',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'overlayed' }, async function (_converse) {
            const flyout = await openResizedChat(_converse);

            // The one invariant the split exists to hold. An off-by-one in
            // either direction (a `max-width: 576px` query in the JS, or the
            // SCSS moving off `sm`) shows up here as a width where one side has
            // collapsed and the other hasn't.
            //
            // No settling delay is needed: both writers of the inline geometry
            // now ask this element's own `viewportMediaQuery`, so there is no
            // longer a window in which they disagree.
            for (const width of [400, NARROW, CUTOFF - 1, CUTOFF, SEAM, 900]) {
                await setViewport(width);
                let observed;
                await u
                    .waitUntil(() => {
                        observed = [cssSaysFullPage(flyout), flyout.style.width === ''];
                        return observed[0] === observed[1];
                    })
                    .catch(() => {
                        const [css, js] = observed;
                        throw new Error(
                            `At ${width}px the CSS and JS disagreed: css_full_page=${css}, js_full_page=${js}`,
                        );
                    });
            }
        }),
    );

    it(
        'keeps a drag-resized width in the old seam',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'overlayed' }, async function (_converse) {
            // 640px is wide enough for the controlbox (250px) beside a chat
            // (300px), which is the whole reason the cutoff sits at 576. The
            // JS used to call it mobile anyway and throw the stored width away
            // while the CSS carried on drawing a desktop box.
            await setViewport(SEAM);
            const flyout = await openResizedChat(_converse);
            expect(flyout.style.width).toBe('420px');
        }),
    );

    it(
        'still drops a drag-resized width below the cutoff',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'overlayed' }, async function (_converse) {
            await setViewport(NARROW);
            const flyout = await openResizedChat(_converse);
            expect(flyout.style.width).toBe('');
        }),
    );

    it(
        'does not let the resize handler put the width back after crossing the cutoff',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'overlayed' }, async function (_converse) {
            // The path the other specs miss: shrink *after* the chat is open,
            // so `dragresize`'s debounced `resize` handler actually runs. It
            // writes the stored dimensions straight onto the element, over
            // whatever the template put there, so it has to consult the same
            // cutoff the template does.
            await setViewport(900);
            const flyout = await openResizedChat(_converse);
            expect(flyout.style.width).toBe('420px');

            await setViewport(NARROW);
            await u.waitUntil(() => flyout.style.width === '');

            // The template clears it immediately; the question is whether the
            // debounced handler hands it back 250ms later.
            await new Promise((resolve) => setTimeout(resolve, DEBOUNCE));
            expect(flyout.style.width).toBe('');
            expect(flyout.style.height).toBe('');
        }),
    );

    it(
        'treats a short viewport as full-page even when it is wide',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'overlayed' }, async function (_converse) {
            // A phone in landscape. Every full-page block in the stylesheets is
            // written twice, once against the width and once against
            // `$mobile_landscape_height`, so a width-only JS check would emit
            // inline geometry that overrides the mobile rules here.
            await setViewport(SEAM, LANDSCAPE_CUTOFF - 50);
            const flyout = await openResizedChat(_converse);
            expect(cssSaysFullPage(flyout)).toBe(true);
            expect(flyout.style.width).toBe('');
            expect(flyout.style.height).toBe('');
        }),
    );
});

describe('The controlbox full-page cutoff', function () {
    it(
        'stays at the md breakpoint, where the controlbox stylesheet puts it',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'overlayed' }, async function (_converse) {
            // `_controlbox.scss` takes #controlbox to `width: 100%` below `md`,
            // not below `sm`. Between the two cutoffs its `!important` width
            // wins but an inline height would still beat
            // `--fullpage-chat-height`, leaving a full-width controlbox stuck
            // at its stored drag height.
            await setViewport(SEAM);
            await mock.openControlBox(_converse);
            const view = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
            const flyout = await u.waitUntil(() => view.querySelector('.box-flyout'));

            view.model.save({ width: 300, height: 360 });
            view.requestUpdate();
            await view.updateComplete;

            expect(flyout.style.height).toBe('');
            expect(flyout.style.width).toBe('');
        }),
    );
});

describe('The occupants sidebar cutoff', function () {
    it(
        'stays at the md breakpoint rather than following the mobile one down',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            await setViewport(900);

            const muc_jid = 'lounge@montague.lit';
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            await u.waitUntil(() => _converse.chatboxviews.get(muc_jid)?.querySelector('converse-muc-chatarea'));
            expect(model.get('hidden_occupants')).toBeFalsy();

            // 700px sits between the two cutoffs. The sidebar question is still
            // answered at 768, so the list hides here even though this is not a
            // full-page viewport.
            await setViewport(700);
            await u.waitUntil(() => model.get('hidden_occupants') === true);
        }),
    );
});
