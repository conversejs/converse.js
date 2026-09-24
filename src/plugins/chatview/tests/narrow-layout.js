import { page } from '@vitest/browser/context';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

// Below Bootstrap's `md` breakpoint (767.98px), where `chatview/styles/index.scss`
// swaps the flyout over to full-page geometry.
const NARROW = 600;

/**
 * Resizes the test iframe and waits for the media query to actually flip,
 * so an assertion cannot run against the previous layout.
 * @param {number} width
 */
async function narrowViewport(width = NARROW) {
    await page.viewport(width, 720);
    await u.waitUntil(() => window.innerWidth === width);
    await u.waitUntil(() => window.matchMedia('(max-width: 767.98px)').matches);
}

describe('Below the md breakpoint, the chat layout', function () {
    it(
        'keeps a fullscreen chat and its heading controls inside the viewport',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            await narrowViewport();
            await mock.waitForRoster(_converse, 'current', 1);

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const flyout = await u.waitUntil(() => view.querySelector('.box-flyout'));
            const rect = flyout.getBoundingClientRect();
            expect(rect.width).toBeGreaterThan(0);
            expect(rect.left).toBeGreaterThanOrEqual(0);
            expect(rect.right).toBeLessThanOrEqual(window.innerWidth);

            // The kebab used to be pushed off the right edge by a `100vw` flyout.
            const buttons = view.querySelector('.chatbox-title__buttons');
            expect(buttons.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
        }),
    );

    it(
        'leaves overlayed chats at their own size instead of stacking them full-page',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'overlayed' }, async function (_converse) {
            await narrowViewport();
            await mock.waitForRoster(_converse, 'current', 2);

            const jids = [0, 1].map((i) => mock.cur_names[i].replace(/ /g, '.').toLowerCase() + '@montague.lit');
            for (const jid of jids) await mock.openChatBoxFor(_converse, jid);

            const flyouts = await u.waitUntil(() => {
                const els = jids.map((jid) => _converse.chatboxviews.get(jid)?.querySelector('.box-flyout'));
                return els.every((el) => el?.getBoundingClientRect().width > 0) ? els : null;
            });

            const rects = flyouts.map((el) => el.getBoundingClientRect());

            // The fullscreen rules are scoped away from overlayed. Picking them up
            // would pin each flyout to the same origin at the full viewport height,
            // leaving only the last one visible.
            rects.forEach((r) => expect(r.height).toBeLessThan(window.innerHeight));
            expect(new Set(rects.map((r) => Math.round(r.left))).size).toBe(rects.length);
        }),
    );
});
