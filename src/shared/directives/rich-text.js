import { Directive, directive } from 'lit/directive.js';
import { RichText } from 'shared/rich-text.js';
import { html } from "lit";
import { until } from 'lit/directives/until.js';


class RichTextRenderer {

    constructor (text, offset, mentions=[], options={}) {
        this.mentions = mentions;
        this.offset = offset;
        this.options = options;
        this.text = text;
    }

    async transform () {
        const text = new RichText(this.text, this.offset, this.mentions, this.options);
        await text.addTemplates();
        return text.payload;
    }

    render () {
        return html`${until(this.transform(), html`${this.text}`)}`;
    }
}


class RichTextDirective extends Directive {
    render (text, offset, mentions, options, callback) { // eslint-disable-line class-methods-use-this
        const renderer = new RichTextRenderer(text, offset, mentions, options);
        const result =renderer.render();
        callback?.();
        return result;
    }
}


const renderRichText = directive(RichTextDirective);
export default renderRichText;
