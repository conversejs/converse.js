import 'shared/avatar/avatar.js';
import { __ } from 'i18n';
import { html } from "lit";
import { until } from 'lit/directives/until.js';
import { setRole, verifyAndSetAffiliation } from "../../utils.js"
import { showOccupantModal } from '../../utils.js';
import { _converse, api } from "@converse/headless/core";

export const tpl_footer = (el) => {
    const model = el.model ?? el.message;
    const jid = model.get('jid');
    const muc = model?.collection?.chatroom;

    if (!jid || !muc) {
        return;
    }

    const role = model.get('role') ?? 'none';
    const affiliation = model.get('affiliation');

    const ownAffiliation = muc.getOwnAffiliation();

    let handleBlock = (ev) => {
        api.blockUser([jid]);
    };
    let handleUnblock = (ev) => {
        api.unblockUser([jid]);
    };
    let handleKick = (ev) => {
        setRole(muc, 'kick', jid, [], ['moderator']);
    };
    let handleMute = (ev) => {
        setRole(muc, 'mute', jid, [], ['moderator']);
    };
    let handleVoice = (ev) => {
        setRole(muc, 'voice', jid, [], ['moderator']);
    };
    let handleOp = (ev) => {
        setRole(muc, 'op', jid, ['admin', 'owner'], ['moderator']);
    };
    let handleDeOp = (ev) => {
        setRole(muc, 'deop', jid, ['admin', 'owner'], ['moderator']);
    };
    let handleBan = (ev) => {
        verifyAndSetAffiliation(muc, 'ban', jid, ["admin", "owner"]);
    };
    let handleMember = (ev) => {
        verifyAndSetAffiliation(muc, 'member', jid, ["admin", "owner"]);
    };
    let handleAdmin = (ev) => {
        verifyAndSetAffiliation(muc, 'admin', jid, ["admin", "owner"]);
    };
    let handleOwner = async (ev) => {
        const confirmed = await _converse.api.confirm("Are you sure you want to promote?",
                ["Promoting a user to owner may be irreversible.",
                 "Only server administrators may demote an owner of a Multi User Chat."],
                []).then((x) => x.length === 0);
        if (confirmed) {
                verifyAndSetAffiliation(muc, 'owner', jid, ["admin", "owner"]);
        } else {
                showOccupantModal(ev, model);
        }
    };

    const blockButton = html`<button class='btn btn-primary' @click=${handleBlock}>Block</button>`
    const unblockButton = html`<button class='btn btn-primary' @click=${handleUnblock}>Unblock</button>`
    const banButton = html`<button class='btn btn-primary' @click=${handleBan}>Ban</button>`
    const kickButton = html`<button class='btn btn-primary' @click=${handleKick}>Kick</button>`

    const muteButton = html`<button class='btn btn-primary' @click=${handleMute}>Mute</button>`
    const unmuteButton = html`<button class='btn btn-primary' @click=${handleVoice}>Unmute</button>`
    const memberButton = (memberText) => html`<button class='btn btn-primary' @click=${handleMember}>${memberText}</button>`
    const addToChatButton   = memberButton("Add to Chat");
    const unbanButton       = memberButton("Unban");
    const removeAdminButton = memberButton("Remove Admin Status");

    const opButton = html`<button class='btn btn-primary' @click=${handleOp}>Make Moderator</button>`
    const deOpButton = html`<button class='btn btn-primary' @click=${handleDeOp}>Remove Moderator Status</button>`
    const adminButton = html`<button class='btn btn-primary' @click=${handleAdmin}>Make Admin</button>`
    const ownerButton = html`<button class='btn btn-primary' @click=${handleOwner}>Make Owner</button>`

    // The following table stores a map from
    // OwnAffiliation x { Target User's Role x Target User's Affiliation } -> Button
    // Mapping to a button rather than a boolean provides us with a bit more
    // flexibility in how we determine the names for certain actions. See
    // the "Add to Chat" button vs the "Unban" button. They both represent
    // a transformation to the target role "Member" but arise from different
    // scenarios

    // The table is more or less copied verbatim from ejabberd's role permissions table

    // Who can ban (set affiliation to outcast)?
    let canBan = ({ 'owner':   [ 'none', 'member', 'admin' ].includes(affiliation) ? banButton : null,
                    'admin':   [ 'none', 'member' ].includes(affiliation) ? banButton : null,
                    'member':  [ 'none', 'member' ].includes(affiliation) ? banButton : null
                            && [ 'visitor', 'none', 'participant' ].includes(role) ? banButton : null,
                 })[ownAffiliation];

    // Who can kick (set role to none)?
    let canKick = ({ 'owner':   [ 'none', 'member', 'admin' ].includes(affiliation) && role !== 'none' ? kickButton : null,
                     'admin':   [ 'none', 'member' ].includes(affiliation) && role !== 'none' ? kickButton : null,
                     'member':  [ 'none', 'member' ].includes(affiliation) && ![' none', 'moderator'].includes(role) ? kickButton : null,
                  })[ownAffiliation];

    // Who can mute (set role to visitor)?
    let canMute = ({ 'owner':   [ 'none', 'member' ].includes(affiliation) && ![ 'visitor' ].includes(role) ? muteButton : null,
                     'admin':   [ 'none', 'member' ].includes(affiliation) && ![ 'visitor' ].includes(role) ? muteButton : null,
                     'member':  [ 'none', 'member' ].includes(affiliation) && ![ 'visitor', 'moderator'].includes(role) ? muteButton : null,
                  })[ownAffiliation];

    // Who can unmute (set role to participant)?
    let canUnmute = ({ 'owner':   [ 'none', 'member' ].includes(affiliation) && [ 'visitor' ].includes(role) ? unmuteButton : null,
                       'admin':   [ 'none', 'member' ].includes(affiliation) && [ 'visitor' ].includes(role) ? unmuteButton : null,
                       'member':  [ 'none', 'member' ].includes(affiliation) && [ 'visitor' ].includes(role) ? unmuteButton : null,
                    })[ownAffiliation];

    // Who can set affiliation to member?
    let canMember = ({ 'owner':  ({ 'admin': removeAdminButton, 'none': addToChatButton, 'outcast': unbanButton })[affiliation],
                       'admin':  ({ 'none': addToChatButton, 'outcast': unbanButton })[affiliation],
                       'member': ({ 'none': addToChatButton })[affiliation],
                    })[ownAffiliation];

    // Who can promote to moderator role?
    let canOp = ({ 'owner':   [ 'none', 'member' ].includes(affiliation) && [ 'none', 'participant' ].includes(role) ? opButton : null,
                   'admin':   [ 'none', 'member' ].includes(affiliation) && [ 'none', 'participant' ].includes(role) ? opButton : null,
                })[ownAffiliation];
    // Who can remove moderator role?
    let canDeOp = ({ 'owner':   [ 'none', 'member' ].includes(affiliation) && role === 'moderator' ? deOpButton : null,
                     'admin':   [ 'none', 'member' ].includes(affiliation) && role === 'moderator' ? deOpButton : null,
                  })[ownAffiliation];

    // Who can change affiliation to admin?
    let canAdmin = ({ 'owner':   [ 'none', 'member' ].includes(affiliation) ? adminButton : null,
                   })[ownAffiliation];

    // Who can change affiliation to owner?
    let canOwner = ({ 'owner':   [ 'none', 'member', 'admin' ].includes(affiliation) ? ownerButton : null,
                   })[ownAffiliation];



    let blocking_plug = _converse.pluggable.plugins['converse-blocking']?.enabled(_converse);

    let determineApplicable = function(command) {
        switch (command) {
            case('kick'):    { return canKick; }
            case('ban'):     { return canBan; }
            case('voice'):   { return canUnmute; }
            case('mute'):    { return canMute; }
            case('op'):      { return canOp; }
            case('deop'):    { return canDeOp; }
            case('member'):  { return canMember; }
            case('admin'):   { return canAdmin; }
            case('owner'):   { return canOwner; }
            case('block'):   { return ( blocking_plug && jid && !api.blockedUsers().has(jid) ? blockButton : null ); }
            case('unblock'): { return ( blocking_plug && jid && api.blockedUsers().has(jid) ? unblockButton : null ); }
            default:         { return null; }
        }
    };

    const applicable_buttons = (muc?.getAllowedCommands() ?? []).map(determineApplicable).filter(x => x);

    return applicable_buttons ? html`<div class="modal-footer">${applicable_buttons}</div>` : null;
}

export const tpl_occupant_modal = (el) => {
    const model = el.model ?? el.message;
    const jid = model?.get('jid');
    const vcard = el.getVcard();
    const nick = model.get('nick');
    const occupant_id = model.get('occupant_id');
    const role = el.model?.get('role');
    const affiliation = el.model?.get('affiliation');
    const hats = el.model?.get('hats')?.length ? el.model.get('hats') : null;
    const muc = el.model.collection.chatroom;

    const i18n_add_to_contacts = __('Add to Contacts');

    const can_see_real_jids = muc.features.get('nonanonymous') || muc.getOwnRole() === 'moderator';
    const not_me =  jid != _converse.bare_jid;

    const add_to_contacts = api.contacts.get(jid)
        .then(contact => !contact && not_me && can_see_real_jids)
        .then(add => add ? html`<li><button class="btn btn-primary" type="button" @click=${() => el.addToContacts()}>${i18n_add_to_contacts}</button></li>` : '');

    return html`
        <div class="row">
            <div class="col-auto">
                <converse-avatar
                    class="avatar modal-avatar"
                    .data=${vcard?.attributes}
                    nonce=${vcard?.get('vcard_updated')}
                    height="120" width="120"></converse-avatar>
            </div>
            <div class="col">
                <ul class="occupant-details">
                    <li>
                        ${ nick ? html`<div class="row"><strong>${__('Nickname')}:</strong></div><div class="row">${nick}</div>` : '' }
                    </li>
                    <li>
                        ${ jid ? html`<div class="row"><strong>${__('XMPP Address')}:</strong></div><div class="row">${jid}</div>` : '' }
                    </li>
                    <li>
                        ${ affiliation ? html`<div class="row"><strong>${__('Affiliation')}:</strong></div><div class="row">${affiliation}</div>` : '' }
                    </li>
                    <li>
                        ${ role ? html`<div class="row"><strong>${__('Roles')}:</strong></div><div class="row">${role}</div>` : '' }
                    </li>
                    <li>
                        ${ hats ? html`<div class="row"><strong>${__('Hats')}:</strong></div><div class="row">${hats}</div>` : '' }
                    </li>
                    <li>
                        ${ occupant_id ? html`<div class="row"><strong>${__('Occupant Id')}:</strong></div><div class="row">${occupant_id}</div>` : '' }
                    </li>
                    ${ until(add_to_contacts, '') }
                </ul>
            </div>
        </div>
    `;
}
