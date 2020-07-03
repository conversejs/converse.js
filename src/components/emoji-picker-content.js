import sizzle from 'sizzle';
import { CustomElement } from './element.js';
import { _converse, api } from "@converse/headless/converse-core";
import { html } from "lit-element";
import { tpl_all_emojis, tpl_search_results } from "../templates/emoji_picker.js";


export default class EmojiPickerContent extends CustomElement {
  static get properties () {
      return {
          'chatview': { type: Object },
          'search_results': { type: Array },
          'current_skintone': { type: String },
          'model': { type: Object },
          'query': { type: String },
      }
  }

  render () {
      const props = {
          'current_skintone': this.current_skintone,
          'insertEmoji': ev => this.insertEmoji(ev),
          'query': this.query,
          'search_results': this.search_results,
          'shouldBeHidden': shortname => this.shouldBeHidden(shortname),
      }
      return html`
          <div class="emoji-picker__lists">
              ${tpl_search_results(props)}
              ${tpl_all_emojis(props)}
          </div>
      `;
  }

  firstUpdated () {
      this.initIntersectionObserver();
  }

  initIntersectionObserver () {
      if (!window.IntersectionObserver) {
          return;
      }
      if (this.observer) {
          this.observer.disconnect();
      } else {
          const options = {
              root: this.querySelector('.emoji-picker__lists'),
              threshold: [0.1]
          }
          const handler = ev => this.setCategoryOnVisibilityChange(ev);
          this.observer = new IntersectionObserver(handler, options);
      }
      sizzle('.emoji-picker', this).forEach(a => this.observer.observe(a));
  }

  setCategoryOnVisibilityChange (ev) {
      const selected = this.parentElement.navigator.selected;
      const intersection_with_selected = ev.filter(i => i.target.contains(selected)).pop();
      let current;
      // Choose the intersection that contains the currently selected
      // element, or otherwise the one with the largest ratio.
      if (intersection_with_selected) {
          current = intersection_with_selected;
      } else {
          current = ev.reduce((p, c) => c.intersectionRatio >= (p?.intersectionRatio || 0) ? c : p, null);
      }
      if (current && current.isIntersecting) {
          const category = current.target.getAttribute('data-category');
          if (category !== this.model.get('current_category')) {
              this.parentElement.preserve_scroll = true;
              this.model.save({'current_category': category});
          }
      }
  }

  insertEmoji (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const target = ev.target.nodeName === 'IMG' ? ev.target.parentElement : ev.target;
      const replace = this.model.get('autocompleting');
      const position = this.model.get('position');
      this.model.set({'autocompleting': null, 'position': null, 'query': ''});
      this.chatview.insertIntoTextArea(target.getAttribute('data-emoji'), replace, false, position);
      this.chatview.emoji_dropdown.toggle();
  }

  shouldBeHidden (shortname) {
      // Helper method for the template which decides whether an
      // emoji should be hidden, based on which skin tone is
      // currently being applied.
      if (shortname.includes('_tone')) {
          if (!this.current_skintone || !shortname.includes(this.current_skintone)) {
              return true;
          }
      } else {
          if (this.current_skintone && _converse.emojis.toned.includes(shortname)) {
              return true;
          }
      }
      if (this.query && !_converse.FILTER_CONTAINS(shortname, this.query)) {
          return true;
      }
      return false;
  }
}

api.elements.define('converse-emoji-picker-content', EmojiPickerContent);
