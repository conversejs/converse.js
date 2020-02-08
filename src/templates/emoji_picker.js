import { html } from "lit-html";
import { __ } from '@converse/headless/i18n';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import xss from "xss/dist/xss";


const i18n_search = __('Search');
const i18n_search_results = __('Search results');
const skintones = ['tone1', 'tone2', 'tone3', 'tone4', 'tone5'];


const emoji_category = (o) => {
    const category_emoji = unsafeHTML(xss.filterXSS(o.transformCategory(o.emoji_categories[o.category]), {'whitelist': {'img': []}}));
    return html`
        <li data-category="${o.category}"
            class="emoji-category ${o.category} ${(o.current_category === o.category) ? 'picked' : ''}"
            title="${__(o._converse.emoji_category_labels[o.category])}">

            <a class="pick-category"
               @click=${o.onCategoryPicked}
               href="#emoji-picker-${o.category}"
               data-category="${o.category}">${category_emoji} </a>
        </li>
    `;
}

const emoji_picker_header = (o) => html`
    <ul>
        ${ Object.keys(o.emoji_categories).map(category => (o.emoji_categories[category] ? emoji_category(Object.assign({category}, o)) : '')) }
    </ul>
`;


const emoji_item = (o) => {
    let emoji;
    if (o._converse.use_system_emojis) {
        emoji = unsafeHTML(xss.filterXSS(o.transform(o.emoji.sn), {'whitelist': {'img': []}}));
    }
    return html`
        <li class="emoji insert-emoji ${o.shouldBeHidden(o.emoji.sn) ? 'hidden' : ''}" data-emoji="${o.emoji.sn}" title="${o.emoji.sn}">
            <a href="#" @click=${o.onEmojiPicked} data-emoji="${o.emoji.sn}">${emoji}</a>
        </li>
    `;
}

const search_results = (o) => html`
    <span ?hidden=${!o.query} class="emoji-lists__container emojis-lists__container--search">
    <a id="emoji-picker-search-results" class="emoji-category__heading">${i18n_search_results}</a>
    <ul class="emoji-picker">
        ${ o.search_results.map(emoji => emoji_item(Object.assign({emoji}, o))) }
    </ul>
    </span>
`;

const emojis_for_category = (o) => html`
    <a id="emoji-picker-${o.category}" class="emoji-category__heading" data-category="${o.category}">${ __(o._converse.emoji_category_labels[o.category]) }</a>
    <ul class="emoji-picker" data-category="${o.category}">
        ${ Object.values(o.emojis_by_category[o.category]).map(emoji => emoji_item(Object.assign({emoji}, o))) }
    </ul>
`;


const skintone_emoji = (o) => {
    const shortname = ':'+o.skintone+':';
    let emoji;
    if (o._converse.use_system_emojis) {
        emoji = unsafeHTML(xss.filterXSS(o.transform(shortname), {'whitelist': {'img': []}}));
    }
    return html`
        <li data-skintone="${o.skintone}" class="emoji-skintone ${(o.current_skintone === o.skintone) ? 'picked' : ''}">
            <a class="pick-skintone" href="#" data-skintone="${o.skintone}" @click=${o.onSkintonePicked}>${emoji}</a>
        </li>
    `;
}


const all_emojis = (o) => html`
    <span ?hidden=${o.query} class="emoji-lists__container emoji-lists__container--browse">
        ${Object.keys(o.emoji_categories).map(category => (o.emoji_categories[category] ? emojis_for_category(Object.assign({category}, o)) : ''))}
    </span>
`;


export default (o) => html`
    <div class="emoji-picker__header">
        <input class="form-control emoji-search" name="emoji-search" placeholder="${i18n_search}"
               .value=${o.query || ''}
               @keydown=${o.onSearchInputKeyDown}
               @blur=${o.onSearchInputBlurred}
               @focus=${o.onSearchInputFocus}>
        ${ o.query ? '' : emoji_picker_header(o) }
    </div>
    <div class="emoji-picker__lists">
        ${search_results(o)}
        ${all_emojis(o)}
    </div>
    <div class="emoji-skintone-picker">
        <label>Skin tone</label>
        <ul>${ skintones.map(skintone => skintone_emoji(Object.assign({skintone}, o))) }</ul>
    </div>
`;
