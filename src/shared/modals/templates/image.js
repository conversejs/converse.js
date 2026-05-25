import { html } from "lit";

export default /** @param {Record<string, string>} o */ (o) => html`<img class="chat-image chat-image--modal" src="${o.src}">`;
