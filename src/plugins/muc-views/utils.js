import log from "@converse/headless/log";
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { parseMessageForCommands } from 'plugins/chatview/utils.js';

const { Strophe, $pres, $iq, sizzle, u } = converse.env;

const COMMAND_TO_AFFILIATION = {
    'admin': 'admin',
    'ban': 'outcast',
    'member': 'member',
    'owner': 'owner',
    'revoke': 'none'
};
const COMMAND_TO_ROLE = {
    'deop': 'participant',
    'kick': 'none',
    'mute': 'visitor',
    'op': 'moderator',
    'voice': 'participant'
};

export function getAutoCompleteListItem (text, input) {
    input = input.trim();
    const element = document.createElement('li');
    element.setAttribute('aria-selected', 'false');

    if (api.settings.get('muc_mention_autocomplete_show_avatar')) {
        const img = document.createElement('img');
        let dataUri = 'data:' + _converse.DEFAULT_IMAGE_TYPE + ';base64,' + _converse.DEFAULT_IMAGE;

        if (_converse.vcards) {
            const vcard = _converse.vcards.findWhere({ 'nickname': text });
            if (vcard) dataUri = 'data:' + vcard.get('image_type') + ';base64,' + vcard.get('image');
        }

        img.setAttribute('src', dataUri);
        img.setAttribute('width', '22');
        img.setAttribute('class', 'avatar avatar-autocomplete');
        element.appendChild(img);
    }

    const regex = new RegExp('(' + input + ')', 'ig');
    const parts = input ? text.split(regex) : [text];

    parts.forEach(txt => {
        if (input && txt.match(regex)) {
            const match = document.createElement('mark');
            match.textContent = txt;
            element.appendChild(match);
        } else {
            element.appendChild(document.createTextNode(txt));
        }
    });

    return element;
}

export async function getAutoCompleteList () {
    const models = [...(await api.rooms.get()), ...(await api.contacts.get())];
    const jids = [...new Set(models.map(o => Strophe.getDomainFromJid(o.get('jid'))))];
    return jids;
}

export async function fetchCommandForm (command) {
    const node = command.node;
    const jid = command.jid;
    const stanza = $iq({
        'type': 'set',
        'to': jid
    }).c('command', {
        'xmlns': Strophe.NS.ADHOC,
        'node': node,
        'action': 'execute'
    });
    try {
        const iq = await api.sendIQ(stanza);
        const cmd_el = sizzle(`command[xmlns="${Strophe.NS.ADHOC}"]`, iq).pop();
        command.sessionid = cmd_el.getAttribute('sessionid');
        command.instructions = sizzle('x[type="form"][xmlns="jabber:x:data"] instructions', cmd_el).pop()?.textContent;
        command.fields = sizzle('x[type="form"][xmlns="jabber:x:data"] field', cmd_el)
            .map(f => u.xForm2TemplateResult(f, cmd_el));

    } catch (e) {
        if (e === null) {
            log.error(`Error: timeout while trying to execute command for ${jid}`);
        } else {
            log.error(`Error while trying to execute command for ${jid}`);
            log.error(e);
        }
        command.fields = [];
    }
}


function setRole (muc, command, args, required_affiliations = [], required_roles = []) {
    const role = COMMAND_TO_ROLE[command];
    if (!role) {
        throw Error(`ChatRoomView#setRole called with invalid command: ${command}`);
    }
    if (!muc.verifyAffiliations(required_affiliations) || !muc.verifyRoles(required_roles)) {
        return false;
    }
    if (!muc.validateRoleOrAffiliationChangeArgs(command, args)) {
        return false;
    }
    const nick_or_jid = muc.getNickOrJIDFromCommandArgs(args);
    if (!nick_or_jid) {
        return false;
    }
    const reason = args.split(nick_or_jid, 2)[1].trim();
    // We're guaranteed to have an occupant due to getNickOrJIDFromCommandArgs
    const occupant = muc.getOccupant(nick_or_jid);
    muc.setRole(occupant, role, reason, undefined, e => muc.onCommandError(e));
    return true;
}


function setAffiliation (muc, command, args, required_affiliations) {
    const affiliation = COMMAND_TO_AFFILIATION[command];
    if (!affiliation) {
        throw Error(`ChatRoomView#setAffiliation called with invalid command: ${command}`);
    }
    if (!muc.verifyAffiliations(required_affiliations)) {
        return false;
    }
    if (!muc.validateRoleOrAffiliationChangeArgs(command, args)) {
        return false;
    }
    const nick_or_jid = muc.getNickOrJIDFromCommandArgs(args);
    if (!nick_or_jid) {
        return false;
    }

    let jid;
    const reason = args.split(nick_or_jid, 2)[1].trim();
    const occupant = muc.getOccupant(nick_or_jid);
    if (occupant) {
        jid = occupant.get('jid');
    } else {
        if (u.isValidJID(nick_or_jid)) {
            jid = nick_or_jid;
        } else {
            const message = __(
                "Couldn't find a participant with that nickname. " + 'They might have left the groupchat.'
            );
            muc.createMessage({ message, 'type': 'error' });
            return;
        }
    }
    const attrs = { jid, reason };
    if (occupant && api.settings.get('auto_register_muc_nickname')) {
        attrs['nick'] = occupant.get('nick');
    }
    muc
        .setAffiliation(affiliation, [attrs])
        .then(() => muc.occupants.fetchMembers())
        .catch(err => muc.onCommandError(err));
}


export function parseMessageForMUCCommands (muc, text) {
    if (
        api.settings.get('muc_disable_slash_commands') &&
        !Array.isArray(api.settings.get('muc_disable_slash_commands'))
    ) {
        return parseMessageForCommands(muc, text);
    }
    text = text.replace(/^\s*/, '');
    const command = (text.match(/^\/([a-zA-Z]*) ?/) || ['']).pop().toLowerCase();
    if (!command) {
        return false;
    }
    const args = text.slice(('/' + command).length + 1).trim();
    if (!muc.getAllowedCommands().includes(command)) {
        return false;
    }

    switch (command) {
        case 'admin': {
            setAffiliation(muc, command, args, ['owner']);
            break;
        }
        case 'ban': {
            setAffiliation(muc, command, args, ['admin', 'owner']);
            break;
        }
        case 'modtools': {
            const chatview = _converse.chatboxviews.get(muc.get('jid'));
            chatview.showModeratorToolsModal(args);
            break;
        }
        case 'deop': {
            // FIXME: /deop only applies to setting a moderators
            // role to "participant" (which only admin/owner can
            // do). Moderators can however set non-moderator's role
            // to participant (e.g. visitor => participant).
            // Currently we don't distinguish between these two
            // cases.
            setRole(muc, command, args, ['admin', 'owner']);
            break;
        }
        case 'destroy': {
            if (!muc.verifyAffiliations(['owner'])) {
                break;
            }
            const chatview = _converse.chatboxviews.get(muc.get('jid'));
            chatview.destroy().catch(e => muc.onCommandError(e));
            break;
        }
        case 'help': {
            muc.set({ 'show_help_messages': false }, { 'silent': true });
            muc.set({ 'show_help_messages': true });
            break;
        }
        case 'kick': {
            setRole(muc, command, args, [], ['moderator']);
            break;
        }
        case 'mute': {
            setRole(muc, command, args, [], ['moderator']);
            break;
        }
        case 'member': {
            setAffiliation(muc, command, args, ['admin', 'owner']);
            break;
        }
        case 'nick': {
            if (!muc.verifyRoles(['visitor', 'participant', 'moderator'])) {
                break;
            } else if (args.length === 0) {
                // e.g. Your nickname is "coolguy69"
                const message = __('Your nickname is "%1$s"', muc.get('nick'));
                muc.createMessage({ message, 'type': 'error' });
            } else {
                const jid = Strophe.getBareJidFromJid(muc.get('jid'));
                api.send(
                    $pres({
                        from: _converse.connection.jid,
                        to: `${jid}/${args}`,
                        id: u.getUniqueId()
                    }).tree()
                );
            }
            break;
        }
        case 'owner':
            setAffiliation(muc, command, args, ['owner']);
            break;
        case 'op': {
            setRole(muc, command, args, ['admin', 'owner']);
            break;
        }
        case 'register': {
            if (args.length > 1) {
                muc.createMessage({
                    'message': __('Error: invalid number of arguments'),
                    'type': 'error'
                });
            } else {
                muc.registerNickname().then(err_msg => {
                    err_msg && muc.createMessage({ 'message': err_msg, 'type': 'error' });
                });
            }
            break;
        }
        case 'revoke': {
            setAffiliation(muc, command, args, ['admin', 'owner']);
            break;
        }
        case 'topic':
        case 'subject':
            muc.setSubject(args);
            break;
        case 'voice': {
            setRole(muc, command, args, [], ['moderator']);
            break;
        }
        default:
            return parseMessageForCommands(muc, text);
    }
    return true;
}
