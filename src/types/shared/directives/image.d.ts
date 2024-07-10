/**
 * lit directive which attempts to render an <img> element from a URL.
 * It will fall back to rendering an <a> element if it can't.
 *
 * @param { String } src - The value that will be assigned to the `src` attribute of the `<img>` element.
 * @param { String } href - The value that will be assigned to the `href` attribute of the `<img>` element.
 * @param { Function } onLoad - A callback function to be called once the image has loaded.
 * @param { Function } onClick - A callback function to be called once the image has been clicked.
 */
export const renderImage: (src?: any, href?: any, onLoad?: any, onClick?: any) => import("lit/async-directive.js").DirectiveResult<typeof ImageDirective>;
declare class ImageDirective extends AsyncDirective {
    render(src: any, href: any, onLoad: any, onClick: any): import("lit").TemplateResult<1>;
    renderImage(src: any, href: any, onLoad: any, onClick: any): import("lit").TemplateResult<1>;
    onError(src: any, href: any, onLoad: any, onClick: any): void;
}
import { AsyncDirective } from "lit/node_modules/lit-html/async-directive";
export {};
//# sourceMappingURL=image.d.ts.map