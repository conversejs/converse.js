import { directive, html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import converse from  "@converse/headless/converse-core";
import tpl_avatar from "templates/avatar.svg";
import URI from "urijs";
import xss from "xss/dist/xss";


const u = converse.env.utils;


function onTagFoundDuringXSSFilter (tag, html, options) {
    /* This function gets called by the XSS library whenever it finds
     * what it thinks is a new HTML tag.
     *
     * It thinks that something like <https://example.com> is an HTML
     * tag and then escapes the <> chars.
     *
     * We want to avoid this, because it prevents these URLs from being
     * shown properly (whithout the trailing &gt;).
     *
     * The URI lib correctly trims a trailing >, but not a trailing &gt;
     */
    if (options.isClosing) {
        // Closing tags don't match our use-case
        return;
    }
    const uri = new URI(tag);
    const protocol = uri.protocol().toLowerCase();
    if (!["https", "http", "xmpp", "ftp"].includes(protocol)) {
        // Not a URL, the tag will get filtered as usual
        return;
    }
    if (uri.equals(tag) && `<${tag}>` === html.toLocaleLowerCase()) {
        // We have something like <https://example.com>, and don't want
        // to filter it.
        return html;
    }
}


const i18n_retract_message = __('Retract this message');
const tpl_retract = html`<button class="chat-msg__action chat-msg__action-retract" title="${i18n_retract_message}">
        <fa-icon class="fas fa-trash-alt" path-prefix="/node_modules" color="var(--text-color-lighten-15-percent)" size="1em"></fa-icon>
    </button>`;


export const renderRetractionLink = directive(o => async part => {
    const is_groupchat_message = o.model.get('type') === 'groupchat';
    const is_own_message = o.model.get('sender') === 'me';
    const may_moderate_message = !is_own_message &&
        is_groupchat_message &&
        await o.model.collection.chatbox.canRetractMessages();

    const may_retract_own_message = is_own_message && ['all', 'own'].includes(o._converse.allow_message_retraction);
    const retractable = !o.is_retracted && (may_moderate_message || may_retract_own_message);
    if (retractable) {
        part.setValue(tpl_retract);
    } else {
        part.setValue('');
    }
    part.commit();
});


export const transformBodyText = directive(component => async part => {
    const model = component.model;
    const _converse = component._converse;

    let text = model.getMessageText();
    /**
     * Synchronous event which provides a hook for transforming a chat message's body text
     * before the default transformations have been applied.
     * @event _converse#beforeMessageBodyTransformed
     * @param { _converse.Message } model - The model representing the message
     * @param { string } text - The message text
     * @example _converse.api.listen.on('beforeMessageBodyTransformed', (view, text) => { ... });
     */
    await _converse.api.trigger('beforeMessageBodyTransformed', model, text, {'Synchronous': true});
    text = u.isMeCommand(text) ? text.substring(4) : text;
    text = xss.filterXSS(text, {'whiteList': {}, 'onTag': onTagFoundDuringXSSFilter});
    text = u.geoUriToHttp(text, _converse.geouri_replacement);
    text = u.addMentionsMarkup(text, model.get('references'), model.collection.chatbox);
    text = u.addHyperlinks(text);
    text = u.renderNewLines(text);
    text = await u.addEmoji(text);
    // TODO: text = u.renderImageURLs(_converse, text);
    // TODO: XSS

    /**
     * Synchronous event which provides a hook for transforming a chat message's body text
     * after the default transformations have been applied.
     * @event _converse#afterMessageBodyTransformed
     * @param { _converse.Message } model - The model representing the message
     * @param { string } text - The message text
     * @example _converse.api.listen.on('afterMessageBodyTransformed', (view, text) => { ... });
     */
    await _converse.api.trigger('afterMessageBodyTransformed', model, text, {'Synchronous': true});
    part.setValue(unsafeHTML(text));
    part.commit();
    model.collection && model.collection.trigger('rendered', model);

    component.registerClickHandlers();
});


export const renderAvatar = directive(o => part => {
    if (o.type === 'headline' || o.is_me_message) {
        part.setValue('');
        return;
    }

    if (o.model.vcard) {
        const data = {
            'classes': 'avatar chat-msg__avatar',
            'width': 36,
            'height': 36,
        }
        const image_type = o.model.vcard.get('image_type');
        const image = o.model.vcard.get('image');
        data['image'] = "data:" + image_type + ";base64," + image;

        // TODO: XSS
        part.setValue(html`${unsafeHTML(tpl_avatar(data))}`);
    }
});
