import { html } from "lit";
import 'shared/components/gif.js';

export default (url, hide_url) =>
    html`<converse-gif autoplay noloop fallback='empty' src=${url}></converse-gif>${ hide_url ? '' : html`<a target="_blank" rel="noopener" href="${url}">${url}</a>` }`;
