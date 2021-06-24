import { __ } from 'i18n';
import { html } from "lit";

export default (url, name) => {
    const i18n_download =  __('Download file "%1$s"', name)
    return html`<a target="_blank" rel="noopener" href="${url}">${i18n_download}</a>`;
}
