import { MessageText } from '../../shared/message/text.js';
import { directive, html } from "lit-html";
import { until } from 'lit-html/directives/until.js';


async function transform (t) {
    await t.addTemplates();
    return t.payload;
}

function renderer (text, model, offset) {
    const t = new MessageText(text, model, offset, false);
    return html`${until(transform(t), html`${t}`)}`;
}

export const renderStylingDirectiveBody = directive((text, model, offset) => p => p.setValue(renderer(text, model, offset)));
