import { Directive, directive } from 'lit/directive.js';
import { RichText } from 'shared/rich-text.js';
import { html } from 'lit';
import { until } from 'lit/directives/until.js';

async function transform (t) {
    await t.addTemplates();
    return t.payload;
}


class StylingDirective extends Directive {

    render (txt, offset, mentions, options) { // eslint-disable-line class-methods-use-this
        const t = new RichText(txt, offset, mentions, Object.assign(options, { 'show_images': false }));
        return html`${until(transform(t), html`${t}`)}`;
    }
}

export const renderStylingDirectiveBody = directive(StylingDirective);
