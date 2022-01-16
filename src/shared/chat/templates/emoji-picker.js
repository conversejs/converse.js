import { __ } from 'i18n';
import { converse, api } from "@converse/headless/core";
import { html } from "lit";

const u = converse.env.utils;


const emoji_category = (o) => {
    return html`
        <li data-category="${o.category}"
            class="emoji-category ${o.category} ${(o.current_category === o.category) ? 'picked' : ''}"
            title="${__(api.settings.get('emoji_category_labels')[o.category])}">

            <a class="pick-category"
               @click=${o.onCategoryPicked}
               href="#emoji-picker-${o.category}"
               data-category="${o.category}">${o.emoji} </a>
        </li>
    `;
}

const emoji_picker_header = (o) => {
    const cats = api.settings.get('emoji_categories');
    const transform = c => cats[c] ? emoji_category(Object.assign({'category': c, 'emoji': o.sn2Emoji(cats[c])}, o)) : '';
    return html`<ul>${ Object.keys(cats).map(transform) }</ul>`;
}

const emoji_item = (o) => {
    return html`
        <li class="emoji insert-emoji ${o.shouldBeHidden(o.emoji.sn) ? 'hidden' : ''}" data-emoji="${o.emoji.sn}" title="${o.emoji.sn}">
            <a href="#" @click=${o.insertEmoji} data-emoji="${o.emoji.sn}">${u.shortnamesToEmojis(o.emoji.sn)}</a>
        </li>
    `;
}

export const tpl_search_results = (o) => {
    const i18n_search_results = __('Search results');
    return html`
        <span ?hidden=${!o.query} class="emoji-lists__container emojis-lists__container--search">
        <a id="emoji-picker-search-results" class="emoji-category__heading">${i18n_search_results}</a>
        <ul class="emoji-picker">
            ${ o.search_results.map(emoji => emoji_item(Object.assign({emoji}, o))) }
        </ul>
        </span>
    `;
}

const emojis_for_category = (o) => {
    return html`
        <a id="emoji-picker-${o.category}" class="emoji-category__heading" data-category="${o.category}">${ __(api.settings.get('emoji_category_labels')[o.category]) }</a>
        <ul class="emoji-picker" data-category="${o.category}">
            ${ Object.values(converse.emojis.json[o.category]).map(emoji => emoji_item(Object.assign({emoji}, o))) }
        </ul>`;
}

export const tpl_all_emojis = (o) => {
    const cats = api.settings.get('emoji_categories');
    return html`
        <span ?hidden=${o.query} class="emoji-lists__container emoji-lists__container--browse">
            ${Object.keys(cats).map(c => (cats[c] ? emojis_for_category(Object.assign({'category': c}, o)) : ''))}
        </span>`;
}


const skintone_emoji = (o) => {
    return html`
        <li data-skintone="${o.skintone}" class="emoji-skintone ${(o.current_skintone === o.skintone) ? 'picked' : ''}">
            <a class="pick-skintone" href="#" data-skintone="${o.skintone}" @click=${o.onSkintonePicked}>${u.shortnamesToEmojis(':'+o.skintone+':')}</a>
        </li>`;
}


export const tpl_emoji_picker = (o) => {
    const i18n_search = __('Search');
    const skintones = ['tone1', 'tone2', 'tone3', 'tone4', 'tone5'];
    return html`
        <div class="emoji-picker__header">
            <input class="form-control emoji-search" name="emoji-search" placeholder="${i18n_search}"
                .value=${o.query || ''}
                @keydown=${o.onSearchInputKeyDown}
                @blur=${o.onSearchInputBlurred}
                @focus=${o.onSearchInputFocus}>
            ${ o.query ? '' : emoji_picker_header(o) }
        </div>
        ${ o.render_emojis ?
            html`<converse-emoji-picker-content
                .chatview=${o.chatview}
                .model=${o.model}
                .search_results="${o.search_results}"
                current_skintone="${o.current_skintone}"
                query="${o.query}"></converse-emoji-picker-content>` : ''}

        <div class="emoji-skintone-picker">
            <ul>${ skintones.map(skintone => skintone_emoji(Object.assign({skintone}, o))) }</ul>
        </div>`;
}
