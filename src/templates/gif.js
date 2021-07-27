import { html } from "lit";
import 'shared/components/gif.js';

export default (url) => html`<converse-gif autoplay noloop src=${url}></converse-gif><a target="_blank" rel="noopener" href="${url}">${url}</a>`;
