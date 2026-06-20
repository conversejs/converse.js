import { html } from 'lit';
import { __ } from 'i18n';

export default () => html`
    <div class="social-placeholder">
        <converse-icon size="3em" class="fa fa-users"></converse-icon>
        <h2>${__('Social')}</h2>
        <p>${__('Microblogging (XEP-0277) is coming soon.')}</p>
    </div>
`;
