import { html } from "lit";

export default (o) => html`<video controls preload="metadata" src="${o.url}" style="max-height: 50vh"></video>`;
