import BaseModal from "plugins/modal/modal.js";
import tplMUCDescription from "../templates/muc-description.js";
import tplMUCList from "../templates/muc-list.js";
import tplSpinner from "templates/spinner.js";
import { __ } from 'i18n';
import { api, converse, log, u } from "@converse/headless";

const { Strophe, $iq, sizzle } = converse.env;
const { getAttributes } = u;


/**
 * Insert groupchat info (based on returned #disco IQ stanza)
 * @param {HTMLElement} el - The HTML DOM element that contains the info.
 * @param {Element} stanza - The IQ stanza containing the groupchat info.
 */
function insertRoomInfo (el, stanza) {
    // All MUC features found here: https://xmpp.org/registrar/disco-features.html
    el.querySelector('span.spinner').remove();
    el.querySelector('a.room-info').classList.add('selected');
    el.insertAdjacentHTML(
        'beforeend',
        u.getElementFromTemplateResult(tplMUCDescription({
            'jid': stanza.getAttribute('from'),
            'desc': sizzle('field[var="muc#roominfo_description"] value', stanza).shift()?.textContent,
            'occ': sizzle('field[var="muc#roominfo_occupants"] value', stanza).shift()?.textContent,
            'hidden': sizzle('feature[var="muc_hidden"]', stanza).length,
            'membersonly': sizzle('feature[var="muc_membersonly"]', stanza).length,
            'moderated': sizzle('feature[var="muc_moderated"]', stanza).length,
            'nonanonymous': sizzle('feature[var="muc_nonanonymous"]', stanza).length,
            'open': sizzle('feature[var="muc_open"]', stanza).length,
            'passwordprotected': sizzle('feature[var="muc_passwordprotected"]', stanza).length,
            'persistent': sizzle('feature[var="muc_persistent"]', stanza).length,
            'publicroom': sizzle('feature[var="muc_publicroom"]', stanza).length,
            'semianonymous': sizzle('feature[var="muc_semianonymous"]', stanza).length,
            'temporary': sizzle('feature[var="muc_temporary"]', stanza).length,
            'unmoderated': sizzle('feature[var="muc_unmoderated"]', stanza).length
        })));
}


/**
 * Show/hide extra information about a groupchat in a listing.
 * @param {Event} ev
 */
function toggleRoomInfo (ev) {
    const parent_el = u.ancestor(ev.target, '.room-item');
    const div_el = parent_el.querySelector('div.room-info');
    if (div_el) {
        u.slideIn(div_el).then(u.removeElement)
        parent_el.querySelector('a.room-info').classList.remove('selected');
    } else {
        parent_el.insertAdjacentElement(
            'beforeend',
            u.getElementFromTemplateResult(tplSpinner())
        );
        api.disco.info(/** @type HTMLElement */(ev.target).getAttribute('data-room-jid'), null)
            .then(stanza => insertRoomInfo(parent_el, stanza))
            .catch(e => log.error(e));
    }
}


export default class MUCListModal extends BaseModal {

    constructor (options) {
        super(options);
        this.items = [];
        this.loading_items = false;
    }

    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change:muc_domain', this.onDomainChange);
        this.listenTo(this.model, 'change:feedback_text', () => this.requestUpdate());

        this.addEventListener('shown.bs.modal', () => api.settings.get('locked_muc_domain') && this.updateRoomsList());

        this.model.save('feedback_text', '');
    }

    renderModal () {
        return tplMUCList(
            Object.assign(this.model.toJSON(), {
                'show_form': !api.settings.get('locked_muc_domain'),
                'server_placeholder': this.model.get('muc_domain') || __('conference.example.org'),
                'items': this.items,
                'loading_items': this.loading_items,
                'openRoom': ev => this.openRoom(ev),
                'setDomainFromEvent': ev => this.setDomainFromEvent(ev),
                'submitForm': ev => this.showRooms(ev),
                'toggleRoomInfo': ev => this.toggleRoomInfo(ev)
            }));
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Query for Groupchats');
    }

    openRoom (ev) {
        ev.preventDefault();
        const jid = ev.target.getAttribute('data-room-jid');
        const name = ev.target.getAttribute('data-room-name');
        this.modal.hide();
        api.rooms.open(jid, {'name': name}, true);
    }

    toggleRoomInfo (ev) {
        ev.preventDefault();
        toggleRoomInfo(ev);
    }

    onDomainChange () {
        this.getElementsByClassName('form-control')[0].value = this.model.get('muc_domain');
        this.items = [];
        this.model.save('feedback_text', '');
        api.settings.get('auto_list_rooms') && this.updateRoomsList();
    }

    /**
     * Handle the IQ stanza returned from the server, containing
     * all its public groupchats.
     * @method _converse.ChatRoomView#onRoomsFound
     * @param {HTMLElement} [iq]
     */
    onRoomsFound (iq) {
        this.loading_items = false;
        const rooms = iq ? sizzle('query item', iq) : [];
        if (rooms.length) {
            this.model.set({'feedback_text': __('Groupchats found')}, {'silent': true});
            this.items = rooms.map(getAttributes);
        } else {
            this.items = [];
            this.model.set({'feedback_text': __('No groupchats found')}, {'silent': true});
        }
        this.requestUpdate();
        return true;
    }

    /**
     * Send an IQ stanza to the server asking for all groupchats
     * @private
     * @method _converse.ChatRoomView#updateRoomsList
     */
    updateRoomsList () {
        const iq = $iq({
            'to': this.model.get('muc_domain'),
            'from': api.connection.get().jid,
            'type': "get"
        }).c("query", {xmlns: Strophe.NS.DISCO_ITEMS});
        api.sendIQ(iq)
            .then(iq => this.onRoomsFound(iq))
            .catch(() => this.onRoomsFound())
    }

    showRooms (ev) {
        ev.preventDefault();
        this.loading_items = true;
        this.requestUpdate();

        const data = new FormData(ev.target);
        this.model.setDomain(data.get('server'));
        this.updateRoomsList();
    }

    setDomainFromEvent (ev) {
        this.model.setDomain(ev.target.value);
    }

    setNick (ev) {
        this.model.save({nick: ev.target.value});
    }
}

api.elements.define('converse-muc-list-modal', MUCListModal);
