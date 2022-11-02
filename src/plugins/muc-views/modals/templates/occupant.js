import 'shared/avatar/avatar.js';
import { __ } from 'i18n';
import { html } from "lit";
import { until } from 'lit/directives/until.js';


export default (o) => {
    const addToContacts = o.addToContacts.then(add => add ? html`<li><button class="btn btn-primary" type="button" @click=${add}>${__('Add to Contacts')}</button></li>` : '');
    return html`
        <div class="row">
            <div class="col-auto">
                <converse-avatar
                    class="avatar modal-avatar"
                    .data=${o.vcard?.attributes}
                    nonce=${o.vcard?.get('vcard_updated')}
                    height="120" width="120"></converse-avatar>
            </div>
            <div class="col">
                <ul class="occupant-details">
                    <li>
                        ${ o.nick ? html`<div class="row"><strong>${__('Nickname')}:</strong></div><div class="row">${o.nick}</div>` : '' }
                    </li>
                    <li>
                        ${ o.jid ? html`<div class="row"><strong>${__('XMPP Address')}:</strong></div><div class="row">${o.jid}</div>` : '' }
                    </li>
                    <li>
                        ${ o.affiliation ? html`<div class="row"><strong>${__('Affiliation')}:</strong></div><div class="row">${o.affiliation}</div>` : '' }
                    </li>
                    <li>
                        ${ o.role ? html`<div class="row"><strong>${__('Roles')}:</strong></div><div class="row">${o.role}</div>` : '' }
                    </li>
                    <li>
                        ${ o.hats ? html`<div class="row"><strong>${__('Hats')}:</strong></div><div class="row">${o.hats}</div>` : '' }
                    </li>
                    <li>
                        ${ o.occupant_id ? html`<div class="row"><strong>${__('Occupant Id')}:</strong></div><div class="row">${o.occupant_id}</div>` : '' }
                    </li>
                    ${ until(addToContacts, '') }
                </ul>
            </div>
        </div>
    `;
}
