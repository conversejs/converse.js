import DOMNavigator from "shared/dom-navigator.js";
import { converse, api } from "@converse/headless/core";
import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import DropdownBase from 'shared/components/dropdownbase.js';


export default class Dropdown extends DropdownBase {

    static get properties () {
        return {
            'icon_classes': { type: String },
            'items': { type: Array }
        }
    }

    render () {
        const icon_classes = this.icon_classes || "fa fa-bars";
        return html`
            <div class="dropleft">
                <button type="button" class="btn btn--transparent btn--standalone" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                    <i class="${icon_classes} only-icon"></i>
                </button>
                <div class="dropdown-menu">
                    ${ this.items.map(b => until(b, '')) }
                </div>
            </div>
        `;
    }

    firstUpdated () {
        super.firstUpdated();
        this.initArrowNavigation();
    }

    hideMenu () {
        super.hideMenu();
        this.navigator?.disable();
    }

    initArrowNavigation () {
        if (!this.navigator) {
            const options = {
                'selector': '.dropdown-item',
                'onSelected': el => el.focus()
            };
            this.navigator = new DOMNavigator(this.menu, options);
        }
    }

    enableArrowNavigation (ev) {
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        this.navigator.enable();
        this.navigator.select(this.menu.firstElementChild);
    }

    handleKeyUp (ev) {
        super.handleKeyUp(ev);
        if (ev.keyCode === converse.keycodes.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        }
    }
}

api.elements.define('converse-dropdown', Dropdown);
