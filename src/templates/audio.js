import { html } from 'lit';

export default (url) => {
    return html`<audio controls src="${url}"></audio><a target="_blank" rel="noopener" href="${url}">${url}</a>`;
}
