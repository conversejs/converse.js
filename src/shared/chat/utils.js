/**
 * @typedef {import('@converse/headless').Message} Message
 * @typedef {import('../../plugins/muc-views/muc.js').default} MUCView
 */
import debounce from 'lodash-es/debounce';
import tplNewDay from './templates/new-day.js';
import { api, converse } from '@converse/headless';
import { html } from 'lit';
import { until } from 'lit/directives/until.js';

const { dayjs, u } = converse.env;
const { convertASCII2Emoji, getShortnameReferences, getCodePointReferences } = u;

export async function getHeadingDropdownItem (promise_or_data) {
    const data = await promise_or_data;
    return data
        ? html`
              <a href="#" role="button"
                class="dropdown-item ${data.a_class}"
                @click=${data.handler} title="${data.i18n_title}">
                  <converse-icon
                      size="1em"
                      class="fa ${data.icon_class}"
                  ></converse-icon>
                  ${data.i18n_text}
              </a>
          `
        : '';
}

export async function getHeadingStandaloneButton (promise_or_data) {
    const data = await promise_or_data;
    return html`
        <button type="button" class="btn chatbox-btn ${data.a_class}"
                @click=${data.handler}
                title="${data.i18n_title}">
            <converse-icon
                size="1em"
                class="fa ${data.icon_class}"
            ></converse-icon>
        </button>
    `;
}

/**
 * @param {Promise} promise
 */
export function getStandaloneButtons (promise) {
    return promise.then(
        btns => btns
            .filter(b => b.standalone)
            .map(b => getHeadingStandaloneButton(b))
            .reverse()
            .map(b => until(b, '')));
}

/**
 * @param {Promise} promise
 */
export function getDropdownButtons (promise) {
    return promise.then((btns) => {
        const dropdown_btns = btns.filter((b) => !b.standalone).map((b) => getHeadingDropdownItem(b));
        return dropdown_btns.length
            ? html`<converse-dropdown
                class="chatbox-btn btn-group dropstart"
                .items=${dropdown_btns}></converse-dropdown>`
            : '';
    });
}


export function onScrolledDown (model) {
    if (!model.isHidden()) {
        if (api.settings.get('allow_url_history_change')) {
            // Clear location hash if set to one of the messages in our history
            const hash = window.location.hash;
            if (hash && model.messages.get(hash.slice(1))) {
               history.pushState(null, '', window.location.pathname);
            }
        }
    }
}

/**
 * Called when the chat content is scrolled up or down.
 * We want to record when the user has scrolled away from
 * the bottom, so that we don't automatically scroll away
 * from what the user is reading when new messages are received.
 *
 * Don't call this method directly, instead, call `markScrolled`,
 * which debounces this method.
 */
function _markScrolled (ev) {
    const el = ev.target;
    if (el.nodeName.toLowerCase() !== 'converse-chat-content') {
        return;
    }
    let scrolled = true;
    const is_at_bottom = Math.floor(el.scrollTop) === 0;
    const is_at_top =
        Math.ceil(el.clientHeight-el.scrollTop) >= (el.scrollHeight-Math.ceil(el.scrollHeight/20));

    if (is_at_bottom) {
        scrolled = false;
        onScrolledDown(el.model);
    } else if (is_at_top) {
        /**
         * Triggered once the chat's message area has been scrolled to the top
         * @event _converse#chatBoxScrolledUp
         * @property { _converse.ChatBoxView | MUCView } view
         * @example _converse.api.listen.on('chatBoxScrolledUp', obj => { ... });
         */
        api.trigger('chatBoxScrolledUp', el);
    }
    if (el.model.get('scolled') !== scrolled) {
        el.model.ui.set({ scrolled });
    }
}

export const markScrolled = debounce((ev) => _markScrolled(ev), 50);


/**
 * Given a message object, returns a TemplateResult indicating a new day if
 * the passed in message is more than a day later than its predecessor.
 * @param {Message} message
 */
export function getDayIndicator (message) {
    const messages = message.collection?.models;
    if (!messages) {
        return;
    }
    const idx = messages.indexOf(message);
    const prev_message =  messages[idx-1];
    if (!prev_message || dayjs(message.get('time')).isAfter(dayjs(prev_message.get('time')), 'day')) {
        const day_date = dayjs(message.get('time')).startOf('day');
        return tplNewDay({
            'type': 'date',
            'time': day_date.toISOString(),
            'datestring': day_date.format("dddd MMM Do YYYY")
        });
    }
}

export function getHats (message) {
    if (message.get('type') === 'groupchat') {
        const allowed_hats = api.settings.get('muc_hats').filter(hat => hat).map((hat) => (hat.toLowerCase()));
        let vcard_roles = []
        if (allowed_hats.includes('vcard_roles')) {
            vcard_roles = message.vcard ? message.vcard.get('role') : null;
            vcard_roles = vcard_roles ? vcard_roles.split(',').filter(hat => hat).map((hat) => ({title: hat})) : [];
        }
        const muc_role = message.occupant ? [message.occupant.get('role')] : [];
        const muc_affiliation = message.occupant ? [message.occupant.get('affiliation')] : [];

        const affiliation_role_hats = [...muc_role, ...muc_affiliation]
            .filter(hat => hat).filter((hat) => (allowed_hats.includes(hat.toLowerCase())))
            .map((hat) => ({title: hat}));
        const hats = allowed_hats.includes('xep317') ? message.occupant?.get('hats') || [] : [];
        return [...hats, ...vcard_roles, ...affiliation_role_hats];
    }
    return [];
}

function unique (arr) {
    return [...new Set(arr)];
}

export function getTonedEmojis () {
    if (!converse.emojis.toned) {
        converse.emojis.toned = unique(
            Object.values(converse.emojis.json.people)
                .filter(person => person.sn.includes('_tone'))
                .map(person => person.sn.replace(/_tone[1-5]/, ''))
        );
    }
    return converse.emojis.toned;
}

/**
 * @typedef {object} EmojiMarkupOptions
 * @property {boolean} [unicode_only=false]
 * @property {boolean} [add_title_wrapper=false]
 *
 * @param {object} data
 * @param {EmojiMarkupOptions} options
 */
export function getEmojiMarkup (data, options={unicode_only: false, add_title_wrapper: false}) {
    const emoji = data.emoji;
    const shortname = data.shortname;
    if (emoji) {
        if (options.unicode_only) {
            return emoji;
        } else if (api.settings.get('use_system_emojis')) {
            if (options.add_title_wrapper) {
                return shortname ? html`<span title="${shortname}">${emoji}</span>` : emoji;
            } else {
                return emoji;
            }
        } else {
            const path = api.settings.get('emoji_image_path');
            return html`<img class="emoji"
                loading="lazy"
                draggable="false"
                title="${shortname}"
                alt="${emoji}"
                src="${path}/72x72/${data.cp}.png"/>`;
        }
    } else if (options.unicode_only) {
        return shortname;
    } else {
        const { url } = converse.emojis.by_sn[shortname];
        return html`<img class="emoji"
            loading="lazy"
            draggable="false"
            title="${shortname}"
            alt="${shortname}"
            src="${url.startsWith('.') ? `${api.settings.get('assets_path')}/${url}` : url}">`;
    }
}

export function addEmojisMarkup (text, options) {
    let list = [text];
    [...getShortnameReferences(text), ...getCodePointReferences(text)]
        .sort((a, b) => b.begin - a.begin)
        .forEach(ref => {
            const text = list.shift();
            const emoji = getEmojiMarkup(ref, options);
            if (typeof emoji === 'string') {
                list = [text.slice(0, ref.begin) + emoji + text.slice(ref.end), ...list];
            } else {
                list = [text.slice(0, ref.begin), emoji, text.slice(ref.end), ...list];
            }
        });
    return list;
}

/**
 * Returns an emoji represented by the passed in shortname.
 * Scans the passed in text for shortnames and replaces them with
 * emoji unicode glyphs or alternatively if it's a custom emoji
 * without unicode representation then a lit TemplateResult
 * which represents image tag markup is returned.
 *
 * The shortname needs to be defined in `emojis.json`
 * and needs to have either a `cp` attribute for the codepoint, or
 * an `url` attribute which points to the source for the image.
 *
 * @namespace u
 * @method u.shortnamesToEmojis
 * @param { String } str - String containg the shortname(s)
 * @param { Object } options
 * @param { Boolean } options.unicode_only - Whether emojis are rendered as
 *  unicode codepoints. If so, the returned result will be an array
 *  with containing one string, because the emojis themselves will
 *  also be strings. If set to false, emojis will be represented by
 *  lit TemplateResult objects.
 * @param { Boolean } options.add_title_wrapper - Whether unicode
 *  codepoints should be wrapped with a `<span>` element with a
 *  title, so that the shortname is shown upon hovering with the
 *  mouse.
 * @returns {Array} An array of at least one string, or otherwise
 * strings and lit TemplateResult objects.
 */
export function shortnamesToEmojis (str, options={unicode_only: false, add_title_wrapper: false}) {
    str = convertASCII2Emoji(str);
    return addEmojisMarkup(str, options);
}


Object.assign(u, { shortnamesToEmojis });
