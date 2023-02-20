import { __ } from 'i18n';
import { _converse, api } from "@converse/headless/core";
import { html } from "lit";
import { until } from 'lit/directives/until.js';
import { showOccupantModal, setRole, verifyAndSetAffiliation } from "../../utils.js"


export default (el) => {
    const model = el.model ?? el.message;
    const jid = model.get('jid');
    const muc = model?.collection?.chatroom;

    if (!jid || !muc) {
        return;
    }

    const role = model.get('role') ?? 'none';
    const affiliation = model.get('affiliation');

    const ownAffiliation = muc.getOwnAffiliation();

    const handleBlock = () => api.blockUser([jid]);
    const handleUnblock = () => api.unblockUser([jid]);
    const handleKick = () => setRole(muc, 'kick', jid, [], ['moderator']);
    const handleMute = () => setRole(muc, 'mute', jid, [], ['moderator']);
    const handleVoice = () => setRole(muc, 'voice', jid, [], ['moderator']);
    const handleOp = () => setRole(muc, 'op', jid, ['admin', 'owner'], ['moderator']);
    const handleDeOp = () => setRole(muc, 'deop', jid, ['admin', 'owner'], ['moderator']);
    const handleBan = () => verifyAndSetAffiliation(muc, 'ban', jid, ["admin", "owner"]);
    const handleMember = () => verifyAndSetAffiliation(muc, 'member', jid, ["admin", "owner"]);
    const handleAdmin = () => verifyAndSetAffiliation(muc, 'admin', jid, ["admin", "owner"]);

    const handleOwner = async (ev) => {
        const confirmed = await _converse.api.confirm(
            __(`Are you sure you want to promote %1$s?`, jid),
            [ __("Promoting a user to owner may be irreversible. "+
                "Only server administrators may demote an owner of a Multi User Chat.")],
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

    // The following table stores a map from Affiliation x Role -> Button
    // Mapping to a button rather than a boolean provides us with a bit more
    // flexibility in how we determine the names for certain actions. See
    // the "Add to Chat" button vs the "Unban" button. They both represent
    // a transformation to the target role "Member" but arise from different
    // scenarios

    // The table is more or less copied verbatim from ejabberd's role permissions table

    // Who can ban (set affiliation to outcast)?
    const canBan = ({
        'owner':   [ 'none', 'member', 'admin' ].includes(affiliation) ? banButton : null,
        'admin':   [ 'none', 'member' ].includes(affiliation) ? banButton : null,
        'member':  [ 'none', 'member' ].includes(affiliation) ? banButton : ([ 'visitor', 'none', 'participant' ].includes(role) ? banButton : null),
    })[ownAffiliation];

    // Who can kick (set role to none)?
    const canKick = ({
        'owner':   [ 'none', 'member', 'admin' ].includes(affiliation) && role !== 'none' ? kickButton : null,
        'admin':   [ 'none', 'member' ].includes(affiliation) && role !== 'none' ? kickButton : null,
        'member':  [ 'none', 'member' ].includes(affiliation) && ![' none', 'moderator'].includes(role) ? kickButton : null,
    })[ownAffiliation];

    // Who can mute (set role to visitor)?
    const canMute = ({
        'owner':   [ 'none', 'member' ].includes(affiliation) && ![ 'visitor' ].includes(role) ? muteButton : null,
        'admin':   [ 'none', 'member' ].includes(affiliation) && ![ 'visitor' ].includes(role) ? muteButton : null,
        'member':  [ 'none', 'member' ].includes(affiliation) && ![ 'visitor', 'moderator'].includes(role) ? muteButton : null,
    })[ownAffiliation];

    // Who can unmute (set role to participant)?
    const canUnmute = ({
        'owner':   [ 'none', 'member' ].includes(affiliation) && [ 'visitor' ].includes(role) ? unmuteButton : null,
        'admin':   [ 'none', 'member' ].includes(affiliation) && [ 'visitor' ].includes(role) ? unmuteButton : null,
        'member':  [ 'none', 'member' ].includes(affiliation) && [ 'visitor' ].includes(role) ? unmuteButton : null,
    })[ownAffiliation];

    // Who can set affiliation to member?
    const canMember = ({
        'owner':  ({ 'admin': removeAdminButton, 'none': addToChatButton, 'outcast': unbanButton })[affiliation],
        'admin':  ({ 'none': addToChatButton, 'outcast': unbanButton })[affiliation],
        'member': ({ 'none': addToChatButton })[affiliation],
    })[ownAffiliation];

    // Who can promote to moderator role?
    const canOp = ({
        'owner':   [ 'none', 'member' ].includes(affiliation) && [ 'none', 'participant' ].includes(role) ? opButton : null,
        'admin':   [ 'none', 'member' ].includes(affiliation) && [ 'none', 'participant' ].includes(role) ? opButton : null,
    })[ownAffiliation];

    // Who can remove moderator role?
    const canDeOp = ({
        'owner':   [ 'none', 'member' ].includes(affiliation) && role === 'moderator' ? deOpButton : null,
        'admin':   [ 'none', 'member' ].includes(affiliation) && role === 'moderator' ? deOpButton : null,
    })[ownAffiliation];

    // Who can change affiliation to admin?
    const canAdmin = ({ 'owner':   [ 'none', 'member' ].includes(affiliation) ? adminButton : null, })[ownAffiliation];

    // Who can change affiliation to owner?
    const canOwner = ({ 'owner':   [ 'none', 'member', 'admin' ].includes(affiliation) ? ownerButton : null, })[ownAffiliation];


    const blocking_plug = _converse.pluggable.plugins['converse-blocking']?.enabled(_converse);

    const determineApplicable = function(command) {
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

    const buttons = muc?.getAllowedCommands()?.then(commands => commands.map(determineApplicable).filter(x => x));

    return html`${until(buttons?.then((buttons) => buttons ? html`<div class="modal-footer">${buttons}</div>` : ''), '')}`;
}
