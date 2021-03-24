import { MessageText } from '../../shared/message/text.js';
import { directive, html } from 'lit-html';
import { until } from 'lit-html/directives/until.js';

async function transform (t) {
    await t.addTemplates();
    return t.payload;
}

function renderer (text, offset, mentions, options) {
    const t = new MessageText(text, offset, mentions, Object.assign(options, { 'show_images': false }));
    return html`${until(transform(t), html`${t}`)}`;
}

export const renderStylingDirectiveBody = directive((txt, offset, mentions, options) =>
    p => p.setValue(renderer(txt, offset, mentions, options))
);
