import converse from '../../../../dist/converse.js';
import { api } from '@converse/headless';

const { u } = converse.env;

describe('ConverseWebPElement', function () {
    it('renders empty fallback content when load_error is set', async function () {
        const original_elements = api.elements;
        api.elements = { 'define': () => {} };
        const { default: ConverseWebPElement } = await import('../component.js');
        api.elements = original_elements;
        spyOn(ConverseWebPElement.prototype, 'initGIF').and.callFake(function () {});
        if (!customElements.get('converse-webp')) {
            customElements.define('converse-webp', ConverseWebPElement);
        }

        const el = document.createElement('converse-webp');
        el.setAttribute('src', 'https://example.com/failing.webp');
        el.setAttribute('fallback', 'empty');
        el.supergif = { load_error: true };
        document.body.appendChild(el);

        await u.waitUntil(() => !el.querySelector('canvas'), 1000);
        expect(el.querySelector('canvas')).toBeNull();

        el.remove();
    });
});
