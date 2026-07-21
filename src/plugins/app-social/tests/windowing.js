import { describe, it, expect } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { makePost, mountSocialFeed, receive } from './utils.js';

const { u } = converse.env;

/**
 * The bodies of the currently rendered posts, in DOM order.
 * @param {Element} el
 * @returns {string[]}
 */
function renderedBodies(el) {
    return Array.from(el.querySelectorAll('.social-post__body')).map((n) => n.textContent.trim());
}

describe('The social feed virtualization', function () {
    it(
        'renders only a window of posts and slides it as you scroll',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = /** @type {any} */ (mountSocialFeed());
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            // Constrain the scroller (inline, so it holds regardless of the
            // stylesheet) to make the post list actually overflow.
            el.style.display = 'block';
            el.style.height = '400px';
            el.style.overflowY = 'auto';

            // More posts than the render window holds, oldest to newest.
            const total = el.window_size + 30;
            const t0 = new Date('2024-01-01T10:00:00Z').getTime();
            for (let i = 0; i < total; i++) {
                const published = new Date(t0 + i * 60000).toISOString();
                receive(_converse, makePost(bare_jid, bare_jid, `post-${i}`, `Post number ${i}`, published));
            }

            // Only the window is in the DOM, pinned to the top: the newest post
            // is rendered, the oldest is not.
            await u.waitUntil(() => el.querySelectorAll('converse-social-message').length === el.window_size);
            const bodies = renderedBodies(el);
            expect(bodies[0]).toBe(`Post number ${total - 1}`);
            expect(bodies).not.toContain('Post number 0');

            // Keep pushing the scroller to the bottom edge: the window slides
            // towards older posts until the oldest is rendered ...
            await u.waitUntil(() => {
                el.scrollTop = el.scrollHeight;
                return renderedBodies(el).includes('Post number 0');
            });
            // ... and the newest posts have been pruned from the DOM.
            expect(el.querySelectorAll('converse-social-message').length).toBe(el.window_size);
            expect(renderedBodies(el)).not.toContain(`Post number ${total - 1}`);

            // Scrolling back to the very top re-pins the window.
            el.scrollTop = 0;
            await u.waitUntil(() => renderedBodies(el)[0] === `Post number ${total - 1}`);
            expect(el.querySelectorAll('converse-social-message').length).toBe(el.window_size);

            // While pinned to the top, a newly arriving post renders live and
            // the window stays capped.
            const published = new Date(t0 + total * 60000).toISOString();
            receive(_converse, makePost(bare_jid, bare_jid, `post-${total}`, `Post number ${total}`, published));
            await u.waitUntil(() => renderedBodies(el)[0] === `Post number ${total}`);
            expect(el.querySelectorAll('converse-social-message').length).toBe(el.window_size);
        }),
    );

    it(
        "doesn't move the reading position when a post arrives above the viewport",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = /** @type {any} */ (mountSocialFeed());
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            el.style.display = 'block';
            el.style.height = '400px';
            el.style.overflowY = 'auto';
            // Disable native scroll anchoring (as the stylesheet does), so this
            // exercises the WindowedListElement compensation specifically.
            el.style.overflowAnchor = 'none';

            const total = 30;
            const t0 = new Date('2024-01-01T10:00:00Z').getTime();
            for (let i = 0; i < total; i++) {
                const published = new Date(t0 + i * 60000).toISOString();
                receive(_converse, makePost(bare_jid, bare_jid, `post-${i}`, `Post number ${i}`, published));
            }
            await u.waitUntil(() => el.querySelectorAll('converse-social-message').length === total);

            // Scroll away from the top and note where the topmost visible post sits.
            el.scrollTop = 600;
            // The reading position is pinned when the browser dispatches the
            // scroll event (in the rendering steps, before the next frame's
            // callbacks); wait a frame so the pin exists before the post arrives.
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const viewport_top = el.getBoundingClientRect().top;
            const anchor = Array.from(el.querySelectorAll('converse-social-message')).find(
                (m) => m.getBoundingClientRect().bottom > viewport_top,
            );
            const anchor_top = anchor.getBoundingClientRect().top;

            // A new post arrives above the viewport (at the top of the timeline).
            const published = new Date(t0 + total * 60000).toISOString();
            receive(_converse, makePost(bare_jid, bare_jid, `post-${total}`, `Post number ${total}`, published));
            await u.waitUntil(() => renderedBodies(el).includes(`Post number ${total}`));

            // The post the user was reading hasn't moved: the position is
            // corrected again once the new post's own render gives it its real
            // height (via the container's ResizeObserver), so assert eventually.
            await u.waitUntil(() => Math.abs(anchor.getBoundingClientRect().top - anchor_top) < 2);
            expect(el.scrollTop).toBeGreaterThan(600);
        }),
    );
});
