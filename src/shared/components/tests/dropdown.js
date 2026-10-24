import { page } from 'vitest/browser';
import { html } from 'lit';
import mock from '../../tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

const NARROW = 400;

/**
 * @param {number} [width]
 */
async function narrowViewport(width = NARROW) {
    await page.viewport(width, 720);
    await u.waitUntil(() => window.innerWidth === width);
}

describe('A Dropdown component', function () {
    it(
        'keeps a dropstart menu inside the viewport on narrow screens',
        mock.initConverse(converse, [], {}, async function () {
            await narrowViewport();

            await customElements.whenDefined('converse-dropdown');
            const el = /** @type {any} */ (document.createElement('converse-dropdown'));
            el.classList.add('chatbox-btn', 'btn-group', 'dropstart');
            el.items = [
                html`<a href="#" class="dropdown-item">Item 1</a>`,
                html`<a href="#" class="dropdown-item">Item 2</a>`,
            ];

            // Position it at the top right, simulating a chat heading menu
            el.style.position = 'fixed';
            el.style.top = '10px';
            el.style.right = '10px';
            document.body.appendChild(el);
            await el.updateComplete;

            el.show();
            await u.waitUntil(() => el.querySelector('.dropdown-menu').classList.contains('show'));
            await new Promise((resolve) => requestAnimationFrame(resolve));

            const menu = el.querySelector('.dropdown-menu');
            await u.waitUntil(() => menu.getAttribute('data-popper-placement') !== null);

            const rect = menu.getBoundingClientRect();
            expect(rect.width).toBeGreaterThan(0);
            expect(rect.height).toBeGreaterThan(0);
            expect(rect.left).toBeGreaterThanOrEqual(0);
            expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
            expect(rect.top).toBeGreaterThanOrEqual(0);
            expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);

            el.hide();
            expect(el._popper).toBe(null);
            el.remove();
        }),
    );
});
