import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { Directive, directive } from 'lit/directive.js';
import { Texture } from './texture.js';

class TextureRenderer {
    /**
     * @param {string} text
     * @param {number} offset
     */
    constructor(text, offset, options = {}) {
        this.offset = offset;
        this.options = options;
        this.text = text;
    }

    async transform() {
        const text = new Texture(this.text, this.offset, this.options);
        try {
            await text.addTemplates();
        } catch (e) {
            console.error(e);
        }
        return text.payload;
    }

    render() {
        return html`${until(this.transform(), html`${this.text}`)}`;
    }
}

class TextureDirective extends Directive {
    /**
     * @param {string} text
     * @param {number} offset
     * @param {object} options
     * @param {Function} [callback]
     */
    render(text, offset, options, callback) {
        const renderer = new TextureRenderer(text, offset, options);
        const result = renderer.render();
        callback?.();
        return result;
    }
}

const renderTexture = directive(TextureDirective);
export default renderTexture;
