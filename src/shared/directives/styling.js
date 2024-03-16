import { log } from '@converse/headless';
import { Directive, directive } from 'lit/directive.js';
import { RichText } from '../rich-text.js';
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
    render (txt, offset, options) {
        const t = new RichText(
            txt,
            offset,
            Object.assign(options, { 'show_images': false, 'embed_videos': false, 'embed_audio': false })
        );
        return html`${until(transform(t), html`${t}`)}`;
    }
}

export const renderStylingDirectiveBody = directive(StylingDirective);
