import { html } from "lit";

export default (url) => html`<video controls preload="metadata" src="${url}"></video><a target="_blank" rel="noopener" href="${url}">${url}</a>`;
