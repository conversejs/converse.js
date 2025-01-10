export default renderTexture;
declare const renderTexture: (text: string, offset: number, options: any, callback?: Function) => import("lit/directive.js").DirectiveResult<typeof TextureDirective>;
declare class TextureDirective extends Directive {
    /**
     * @param {string} text
     * @param {number} offset
     * @param {object} options
     * @param {Function} [callback]
     */
    render(text: string, offset: number, options: object, callback?: Function): import("lit").TemplateResult<1>;
}
import { Directive } from 'lit/directive.js';
//# sourceMappingURL=directive.d.ts.map