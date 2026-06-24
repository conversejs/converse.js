import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('ConverseWebPElement', function () {
    it('renders empty fallback content when load_error is set', async function () {
        const WebPElement = customElements.get('converse-webp');
        spyOn(WebPElement.prototype, 'initGIF').and.callFake(function () {});

        const el = /** @type {HTMLElement} */ (document.createElement('converse-webp'));
        el.setAttribute('src', 'https://example.com/failing.webp');
        el.setAttribute('fallback', 'empty');
        document.body.appendChild(el);
        el.supergif = { load_error: true };
        el.requestUpdate();

        await u.waitUntil(() => !el.querySelector('canvas'), 1000);
        expect(el.querySelector('canvas')).toBeNull();

        el.remove();
    });
});
