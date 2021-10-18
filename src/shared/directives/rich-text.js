import log from '@converse/headless/log.js';
import { Directive, directive } from 'lit/directive.js';
import { RichText } from 'shared/rich-text.js';
import { html } from "lit";
import { until } from 'lit/directives/until.js';


class RichTextRenderer {

    constructor (text, offset, options={}) {
        this.offset = offset;
        this.options = options;
        this.text = text;
    }

    async transform () {
        const text = new RichText(this.text, this.offset, this.options);
        try {
            await text.addTemplates();
        } catch (e) {
            log.error(e);
        }
        return text.payload;
    }

    render () {
        return html`${until(this.transform(), html`${this.text}`)}`;
    }
}


class RichTextDirective extends Directive {
    render (text, offset, options, callback) { // eslint-disable-line class-methods-use-this
        const renderer = new RichTextRenderer(text, offset, options);
        const result = renderer.render();
        callback?.();
        return result;
    }
}


const renderRichText = directive(RichTextDirective);
export default renderRichText;
