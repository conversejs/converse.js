import log from '@converse/headless/log.js';
import { Directive, directive } from 'lit/directive.js';
import { RichText } from 'shared/rich-text.js';
import { html } from 'lit';
import { until } from 'lit/directives/until.js';

async function transform (t) {
    try {
        await t.addTemplates();
    } catch (e) {
        log.error(e);
    }
    return t.payload;
}

class StylingDirective extends Directive {
    render (txt, offset, options) { // eslint-disable-line class-methods-use-this
        const t = new RichText(
            txt,
            offset,
            Object.assign(options, { 'show_images': false, 'embed_videos': false, 'embed_audio': false })
        );
        return html`${until(transform(t), html`${t}`)}`;
    }
}

export const renderStylingDirectiveBody = directive(StylingDirective);
