import { html } from "lit";

export default (url, hide_url) =>
    html`<video controls preload="metadata" src="${url}"></video>${ hide_url ? '' : html`<a target="_blank" rel="noopener" href="${url}">${url}</a>` }`;
