/**
 * lit directive which attempts to render an <img> element from a URL.
 * It will fall back to rendering an <a> element if it can't.
 *
 * @param { String } src - The value that will be assigned to the `src` attribute of the `<img>` element.
 * @param { String } href - The value that will be assigned to the `href` attribute of the `<img>` element.
 * @param { Function } onLoad - A callback function to be called once the image has loaded.
 * @param { Function } onClick - A callback function to be called once the image has been clicked.
 */
export const renderImage: (src: string, href?: string, onLoad?: Function, onClick?: Function) => import("lit/async-directive.js").DirectiveResult<typeof ImageDirective>;
declare class ImageDirective extends AsyncDirective {
    /**
     * @param {string} src - The source URL of the image.
     * @param {string} [href] - The optional hyperlink for the image.
     * @param {Function} [onLoad] - Callback function to be called once the image has loaded.
     * @param {Function} [onClick] - Callback function to be called once the image has been clicked.
     * @returns {import('lit').TemplateResult}
     */
    render(src: string, href?: string, onLoad?: Function, onClick?: Function): import("lit").TemplateResult;
    /**
     * @param {string} src - The source URL of the image.
     * @param {string} [href] - The optional hyperlink for the image.
     * @param {Function} [onLoad] - Callback function to be called once the image has loaded.
     * @param {Function} [onClick] - Callback function to be called once the image has been clicked.
     * @returns {import('lit').TemplateResult}
     */
    renderImage(src: string, href?: string, onLoad?: Function, onClick?: Function): import("lit").TemplateResult;
    /**
     * Handles errors that occur during image loading.
     * @param {string} src - The source URL of the image that failed to load.
     * @param {string} [href] - The optional hyperlink for the image.
     * @param {Function} [onLoad] - Callback function to be called once the image has loaded.
     * @param {Function} [onClick] - Callback function to be called once the image has been clicked.
     */
    onError(src: string, href?: string, onLoad?: Function, onClick?: Function): void;
}
import { AsyncDirective } from 'lit/async-directive.js';
export {};
//# sourceMappingURL=image.d.ts.map