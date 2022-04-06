import { CustomElement } from 'shared/components/element.js';
import { _converse, converse, api } from "@converse/headless/core";
import { html } from "lit";
import { tpl_all_emojis, tpl_search_results } from "./templates/emoji-picker.js";
import { getTonedEmojis } from './utils.js';

const { sizzle } = converse.env;


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

  setCategoryOnVisibilityChange (entries) {
      const selected = this.parentElement.navigator.selected;
      const intersection_with_selected = entries.filter(i => i.target.contains(selected)).pop();
      let current;
      // Choose the intersection that contains the currently selected
      // element, or otherwise the one with the largest ratio.
      if (intersection_with_selected) {
          current = intersection_with_selected;
      } else {
          current = entries.reduce((p, c) => c.intersectionRatio >= (p?.intersectionRatio || 0) ? c : p, null);
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
      this.parentElement.insertIntoTextArea(target.getAttribute('data-emoji'));
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
          if (this.current_skintone && getTonedEmojis().includes(shortname)) {
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
