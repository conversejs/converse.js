import { MessageText } from 'shared/message/text.js';
import { directive, html } from "lit-html";
import { until } from 'lit-html/directives/until.js';


class RichTextRenderer {

    constructor (text, offset, mentions=[], options={}) {
        this.mentions = mentions;
        this.offset = offset;
        this.options = options;
        this.text = text;
    }

    async transform () {
        const text = new MessageText(this.text, this.offset, this.mentions, this.options);
        await text.addTemplates();
        return text.payload;
    }

    render () {
        return html`${until(this.transform(), html`${this.text}`)}`;
    }
}


const renderRichText = directive((text, offset, mentions, options, callback) => part => {
    const renderer = new RichTextRenderer(text, offset, mentions, options);
    part.setValue(renderer.render());
    callback();
});

export default renderRichText;
