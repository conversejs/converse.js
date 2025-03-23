import { html } from "lit";
import { until } from 'lit/directives/until.js';
import { __ } from 'i18n';
import { _converse, api } from "@converse/headless";
import { getStandaloneButtons, getDropdownButtons } from 'shared/chat/utils.js';
import 'shared/components/dropdown.js';
import 'shared/texture/components/texture.js';

/** @param {import('../heading').default} el} */
export default (el) => {
    const o = el.model.toJSON();
    const subject_hidden = el.user_settings?.get('mucs_with_hidden_subject', [])?.includes(el.model.get('jid'));
    const heading_buttons_promise = el.getHeadingButtons(subject_hidden);
    const i18n_hide_topic = __('Hide the groupchat topic');
    const subject = o.subject ? o.subject.text : '';
    const show_subject = (subject && !subject_hidden);
    return html`
        <div class="chatbox-title ${ show_subject ? '' :  "chatbox-title--no-desc"}">

            <a data-room-jid="${el.model.get('jid')}"
               title="${__('Show more information on this groupchat')}"
               @click=${(ev) => el.showRoomDetailsModal(ev)}>

                <converse-avatar
                    .model=${el.model}
                    class="avatar align-self-center"
                    name="${el.model.getDisplayName()}"
                    nonce=${el.model.vcard?.get('vcard_updated')}
                    height="40" width="40"></converse-avatar>
            </a>

            <div class="chatbox-title--row">
                ${ (!_converse.api.settings.get("singleton")) ?
                        html`<converse-controlbox-navback jid="${o.jid}"></converse-controlbox-navback>` : '' }
                <div class="chatbox-title__text"
                     role="heading" aria-level="2"
                     title="${ (api.settings.get('locked_muc_domain') !== 'hidden') ? o.jid : '' }">
                    ${ el.model.getDisplayName() }
                </div>
            </div>
            <div class="chatbox-title__buttons btn-toolbar g-0">
                ${ until(getStandaloneButtons(heading_buttons_promise), '') }
                ${ until(getDropdownButtons(heading_buttons_promise), '') }
            </div>
        </div>
        ${ show_subject ? html`<p class="chat-head__desc" title="${i18n_hide_topic}">
            <converse-texture text=${subject} render_styling embed_audio></converse-texture>
          </p>` : '' }
    `;
}
