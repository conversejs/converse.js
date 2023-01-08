/* global libsignal */
import log from '@converse/headless/log';
import tpl_audio from 'templates/audio.js';
import tpl_file from 'templates/file.js';
import tpl_image from 'templates/image.js';
import tpl_video from 'templates/video.js';
import { __ } from 'i18n';
import { _converse, converse, api } from '@converse/headless/core';
import { html } from 'lit';
import { isError } from '@converse/headless/utils/core.js';
import { isAudioURL, isImageURL, isVideoURL, getURI } from '@converse/headless/utils/url.js';
import { processEncryptedFiles } from '@converse/headless/plugins/omemo/utils.js'
import { until } from 'lit/directives/until.js';

const { u } = converse.env;

function getTemplateForObjectURL (uri, obj_url, richtext) {
    if (isError(obj_url)) {
        return html`<p class="error">${obj_url.message}</p>`;
    }

    const file_url = uri.toString();
    if (isImageURL(file_url)) {
        return tpl_image({
            'src': obj_url,
            'onClick': richtext.onImgClick,
            'onLoad': richtext.onImgLoad
        });
    } else if (isAudioURL(file_url)) {
        return tpl_audio(obj_url);
    } else if (isVideoURL(file_url)) {
        return tpl_video(obj_url);
    } else {
        return tpl_file(obj_url, uri.filename());
    }

}

function addEncryptedFiles(text, offset, richtext) {
    const objs = processEncryptedFiles(text);

    objs.forEach(o => {
        o.obj_url.then(obj_url => getTemplateForObjectURL(o.uri, obj_url, richtext));

        const template = html`${until(o.obj_url, '')}`;
        richtext.addTemplateResult(o.start + offset, o.end + offset, template);
    });
}

export function handleEncryptedFiles (richtext) {
    if (!_converse.config.get('trusted')) {
        return;
    }
    richtext.addAnnotations((text, offset) => addEncryptedFiles(text, offset, richtext));
}

export function onChatInitialized (el) {
    el.listenTo(el.model, 'change:omemo_supported', () => {
        if (el.model.get('omemo_supported') || !el.model.get('omemo_active')) {
            // Do nothing; the model will be updated by
            // onChatBoxInitialized in the headless plugin
        } else {
            // Manually trigger an update, setting omemo_active to
            // false above will automatically trigger one.
            el.querySelector('converse-chat-toolbar')?.requestUpdate();
        }
    });
    el.listenTo(el.model, 'change:omemo_active', () => {
        el.querySelector('converse-chat-toolbar').requestUpdate();
    });
}

function toggleOMEMO (ev) {
    ev.stopPropagation();
    ev.preventDefault();
    const toolbar_el = u.ancestor(ev.target, 'converse-chat-toolbar');
    if (!toolbar_el.model.get('omemo_supported')) {
        let messages;
        if (toolbar_el.model.get('type') === _converse.CHATROOMS_TYPE) {
            messages = [
                __(
                    'Cannot use end-to-end encryption in this groupchat, ' +
                        'either the groupchat has some anonymity or not all participants support OMEMO.'
                )
            ];
        } else {
            messages = [
                __(
                    "Cannot use end-to-end encryption because %1$s uses a client that doesn't support OMEMO.",
                    toolbar_el.model.contact.getDisplayName()
                )
            ];
        }
        return api.alert('error', __('Error'), messages);
    }
    toolbar_el.model.save({ 'omemo_active': !toolbar_el.model.get('omemo_active') });
}

export function getOMEMOToolbarButton (toolbar_el, buttons) {
    const model = toolbar_el.model;
    const is_muc = model.get('type') === _converse.CHATROOMS_TYPE;
    let title;
    if (model.get('omemo_supported')) {
        const i18n_plaintext = __('Messages are being sent in plaintext');
        const i18n_encrypted = __('Messages are sent encrypted');
        title = model.get('omemo_active') ? i18n_encrypted : i18n_plaintext;
    } else if (is_muc) {
        title = __(
            'This groupchat needs to be members-only and non-anonymous in ' +
                'order to support OMEMO encrypted messages'
        );
    } else {
        title = __('OMEMO encryption is not supported');
    }

    let color;
    if (model.get('omemo_supported')) {
        if (model.get('omemo_active')) {
            color = is_muc ? `var(--muc-color)` : `var(--chat-toolbar-btn-color)`;
        } else {
            color = `var(--error-color)`;
        }
    } else {
        color = `var(--muc-toolbar-btn-disabled-color)`;
    }
    buttons.push(html`
        <button class="toggle-omemo" title="${title}" data-disabled=${!model.get('omemo_supported')} @click=${toggleOMEMO}>
            <converse-icon
                class="fa ${model.get('omemo_active') ? `fa-lock` : `fa-unlock`}"
                path-prefix="${api.settings.get('assets_path')}"
                size="1em"
                color="${color}"
            ></converse-icon>
        </button>
    `);
    return buttons;
}
