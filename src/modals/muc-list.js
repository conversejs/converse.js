import log from "@converse/headless/log";
import sizzle from 'sizzle';
import st from "@converse/headless/utils/stanza";
import tpl_list_chatrooms_modal from "templates/list_chatrooms_modal.js";
import tpl_room_description from "templates/room_description.html";
import tpl_spinner from "templates/spinner.js";
import { BootstrapModal } from "../converse-modal.js";
import { Strophe, $iq } from 'strophe.js/src/strophe';
import { __ } from '../i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";
import { head } from "lodash-es";

const u = converse.env.utils;


/* Insert groupchat info (based on returned #disco IQ stanza)
 * @function insertRoomInfo
 * @param { HTMLElement } el - The HTML DOM element that contains the info.
 * @param { XMLElement } stanza - The IQ stanza containing the groupchat info.
 */
function insertRoomInfo (el, stanza) {
    // All MUC features found here: https://xmpp.org/registrar/disco-features.html
    el.querySelector('span.spinner').remove();
    el.querySelector('a.room-info').classList.add('selected');
    el.insertAdjacentHTML(
        'beforeEnd',
        tpl_room_description({
            'jid': stanza.getAttribute('from'),
            'desc': head(sizzle('field[var="muc#roominfo_description"] value', stanza))?.textContent,
            'occ': head(sizzle('field[var="muc#roominfo_occupants"] value', stanza))?.textContent,
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
            'unmoderated': sizzle('feature[var="muc_unmoderated"]', stanza).length,
            'label_desc': __('Description:'),
            'label_jid': __('Groupchat Address (JID):'),
            'label_occ': __('Participants:'),
            'label_features': __('Features:'),
            'label_requires_auth': __('Requires authentication'),
            'label_hidden': __('Hidden'),
            'label_requires_invite': __('Requires an invitation'),
            'label_moderated': __('Moderated'),
            'label_non_anon': __('Non-anonymous'),
            'label_open_room': __('Open'),
            'label_permanent_room': __('Permanent'),
            'label_public': __('Public'),
            'label_semi_anon':  __('Semi-anonymous'),
            'label_temp_room':  __('Temporary'),
            'label_unmoderated': __('Unmoderated')
        }));
}


/**
 * Show/hide extra information about a groupchat in a listing.
 * @function toggleRoomInfo
 * @param { Event }
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
            u.getElementFromTemplateResult(tpl_spinner())
        );
        api.disco.info(ev.target.getAttribute('data-room-jid'), null)
            .then(stanza => insertRoomInfo(parent_el, stanza))
            .catch(e => log.error(e));
    }
}


export default BootstrapModal.extend({
    id: "list-chatrooms-modal",

    initialize () {
        this.items = [];
        this.loading_items = false;

        BootstrapModal.prototype.initialize.apply(this, arguments);
        if (api.settings.get('muc_domain') && !this.model.get('muc_domain')) {
            this.model.save('muc_domain', api.settings.get('muc_domain'));
        }
        this.listenTo(this.model, 'change:muc_domain', this.onDomainChange);

        this.el.addEventListener('shown.bs.modal', () => api.settings.get('locked_muc_domain')
          ? this.updateRoomsList()
          : this.el.querySelector('input[name="server"]').focus()
        );
    },

    toHTML () {
        const muc_domain = this.model.get('muc_domain') || api.settings.get('muc_domain');
        return tpl_list_chatrooms_modal(
            Object.assign(this.model.toJSON(), {
                'show_form': !api.settings.get('locked_muc_domain'),
                'server_placeholder': muc_domain ? muc_domain : __('conference.example.org'),
                'items': this.items,
                'loading_items': this.loading_items,
                'openRoom': ev => this.openRoom(ev),
                'setDomainFromEvent': ev => this.setDomainFromEvent(ev),
                'submitForm': ev => this.showRooms(ev),
                'toggleRoomInfo': ev => this.toggleRoomInfo(ev)
            }));
    },

    openRoom (ev) {
        ev.preventDefault();
        const jid = ev.target.getAttribute('data-room-jid');
        const name = ev.target.getAttribute('data-room-name');
        this.modal.hide();
        api.rooms.open(jid, {'name': name}, true);
    },

    toggleRoomInfo (ev) {
        ev.preventDefault();
        toggleRoomInfo(ev);
    },

    onDomainChange () {
        api.settings.get('auto_list_rooms') && this.updateRoomsList();
    },

    /**
     * Handle the IQ stanza returned from the server, containing
     * all its public groupchats.
     * @private
     * @method _converse.ChatRoomView#onRoomsFound
     * @param { HTMLElement } iq
     */
    onRoomsFound (iq) {
        this.loading_items = false;
        const rooms = iq ? sizzle('query item', iq) : [];
        if (rooms.length) {
            this.model.set({'feedback_text': __('Groupchats found')}, {'silent': true});
            this.items = rooms.map(st.getAttributes);
        } else {
            this.items = [];
            this.model.set({'feedback_text': __('No groupchats found')}, {'silent': true});
        }
        this.render();
        return true;
    },

    /**
     * Send an IQ stanza to the server asking for all groupchats
     * @private
     * @method _converse.ChatRoomView#updateRoomsList
     */
    updateRoomsList () {
        const iq = $iq({
            'to': this.model.get('muc_domain'),
            'from': _converse.connection.jid,
            'type': "get"
        }).c("query", {xmlns: Strophe.NS.DISCO_ITEMS});
        api.sendIQ(iq)
            .then(iq => this.onRoomsFound(iq))
            .catch(() => this.onRoomsFound())
    },

    showRooms (ev) {
        ev.preventDefault();
        this.loading_items = true;
        this.render();

        const data = new FormData(ev.target);
        this.model.setDomain(data.get('server'));
        this.updateRoomsList();
    },

    setDomainFromEvent (ev) {
        this.model.setDomain(ev.target.value);
    },

    setNick (ev) {
        this.model.save({nick: ev.target.value});
    }
});
