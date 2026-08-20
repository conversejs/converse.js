/**
 * lit directive which attempts to render an <img> element from a URL.
 * It will fall back to rendering an <a> element if it can't.
 *
 * @param { String } src - The value that will be assigned to the `src` attribute of the `<img>` element.
 * @param { String } href - The value that will be assigned to the `href` attribute of the `<img>` element.
 * @param { Function } onLoad - A callback function to be called once the image has loaded.
 * @param { Function } onClick - A callback function to be called once the image has been clicked.
 * @param { String } filename - The original filename, used as the `download` name for opaque URLs.
 */
export const renderImage: (src: string, href?: string, onLoad?: Function, onClick?: Function, filename?: string) => import("lit-html/directive.js").DirectiveResult<typeof ImageDirective>;
declare class ImageDirective extends AsyncDirective {
    /**
     * @param {string} src - The source URL of the image.
     * @param {string} [href] - The optional hyperlink for the image.
     * @param {Function} [onLoad] - Callback function to be called once the image has loaded.
     * @param {Function} [onClick] - Callback function to be called once the image has been clicked.
     * @param {string} [filename] - The original filename, used as the download name when
     *  the `src` is an opaque URL (e.g. a `blob:` URL for a decrypted OMEMO image).
     * @returns {import('lit').TemplateResult}
     */
    render(src: string, href?: string, onLoad?: Function, onClick?: Function, filename?: string): import("lit").TemplateResult;
    /**
     * @param {string} src - The source URL of the image.
     * @param {string} [href] - The optional hyperlink for the image.
     * @param {Function} [onLoad] - Callback function to be called once the image has loaded.
     * @param {Function} [onClick] - Callback function to be called once the image has been clicked.
     * @param {string} [filename] - The original filename of the image.
     * @returns {import('lit').TemplateResult}
     */
    renderImage(src: string, href?: string, onLoad?: Function, onClick?: Function, filename?: string): import("lit").TemplateResult;
    /**
     * Handles errors that occur during image loading.
     * @param {string} src - The source URL of the image that failed to load.
     * @param {string} [href] - The optional hyperlink for the image.
     * @param {Function} [onLoad] - Callback function to be called once the image has loaded.
     * @param {Function} [onClick] - Callback function to be called once the image has been clicked.
     * @param {string} [filename] - The original filename of the image.
     */
    onError(src: string, href?: string, onLoad?: Function, onClick?: Function, filename?: string): string | import("utils/html.js").TemplateResult;
}
import { AsyncDirective } from "lit/async-directive.js";
export {};
//# sourceMappingURL=image.d.ts.map