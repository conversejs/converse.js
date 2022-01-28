import ModeratorToolsModal from './modals/moderator-tools.js';
import OccupantModal from 'modals/occupant.js';
import log from "@converse/headless/log";
import tpl_spinner from 'templates/spinner.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { html } from "lit";
import { parseMessageForCommands } from 'plugins/chatview/utils.js';
import { setAffiliation } from '@converse/headless/plugins/muc/affiliations/utils.js';

const { Strophe, $iq, sizzle, u } = converse.env;

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

export function clearHistory (jid) {
    if (_converse.router.history.getFragment() === `converse/room?jid=${jid}`) {
        _converse.router.navigate('');
    }
}

export async function destroyMUC (model) {
    const messages = [__('Are you sure you want to destroy this groupchat?')];
    let fields = [
        {
            'name': 'challenge',
            'label': __('Please enter the XMPP address of this groupchat to confirm'),
            'challenge': model.get('jid'),
            'placeholder': __('name@example.org'),
            'required': true
        },
        {
            'name': 'reason',
            'label': __('Optional reason for destroying this groupchat'),
            'placeholder': __('Reason')
        },
        {
            'name': 'newjid',
            'label': __('Optional XMPP address for a new groupchat that replaces this one'),
            'placeholder': __('replacement@example.org')
        }
    ];
    try {
        fields = await api.confirm(__('Confirm'), messages, fields);
        const reason = fields.filter(f => f.name === 'reason').pop()?.value;
        const newjid = fields.filter(f => f.name === 'newjid').pop()?.value;
        return model.sendDestroyIQ(reason, newjid).then(() => model.close());
    } catch (e) {
        log.error(e);
    }
}


function setMUCDomain (domain, controlboxview) {
    controlboxview.querySelector('converse-rooms-list')
        .model.save('muc_domain', Strophe.getDomainFromJid(domain));
}

function setMUCDomainFromDisco (controlboxview) {
    /* Check whether service discovery for the user's domain
     * returned MUC information and use that to automatically
     * set the MUC domain in the "Add groupchat" modal.
     */
    function featureAdded (feature) {
        if (!feature) {
            return;
        }
        if (feature.get('var') === Strophe.NS.MUC) {
            feature.entity.getIdentity('conference', 'text').then(identity => {
                if (identity) {
                    setMUCDomain(feature.get('from'), controlboxview);
                }
            });
        }
    }
    api.waitUntil('discoInitialized')
        .then(() => {
            api.listen.on('serviceDiscovered', featureAdded);
            // Features could have been added before the controlbox was
            // initialized. We're only interested in MUC
            _converse.disco_entities.each(entity => featureAdded(entity.features.findWhere({ 'var': Strophe.NS.MUC })));
        })
        .catch(e => log.error(e));
}

export function fetchAndSetMUCDomain (controlboxview) {
    if (controlboxview.model.get('connected')) {
        if (!controlboxview.querySelector('converse-rooms-list').model.get('muc_domain')) {
            if (api.settings.get('muc_domain') === undefined) {
                setMUCDomainFromDisco(controlboxview);
            } else {
                setMUCDomain(api.settings.get('muc_domain'), controlboxview);
            }
        }
    }
}

export function getNicknameRequiredTemplate (model) {
    const jid = model.get('jid');
    if (api.settings.get('muc_show_logs_before_join')) {
        return html`<converse-muc-chatarea jid="${jid}"></converse-muc-chatarea>`;
    } else {
        return html`<converse-muc-nickname-form jid="${jid}"></converse-muc-nickname-form>`;
    }
}

export function getChatRoomBodyTemplate (o) {
    const view = o.model.session.get('view');
    const jid = o.model.get('jid');
    const RS = converse.ROOMSTATUS;
    const conn_status =  o.model.session.get('connection_status');

    if (view === converse.MUC.VIEWS.CONFIG) {
        return html`<converse-muc-config-form class="muc-form-container" jid="${jid}"></converse-muc-config-form>`;
    } else if (view === converse.MUC.VIEWS.BOOKMARK) {
        return html`<converse-muc-bookmark-form class="muc-form-container" jid="${jid}"></converse-muc-bookmark-form>`;
    } else {
        return html`
            ${ conn_status == RS.PASSWORD_REQUIRED ? html`<converse-muc-password-form class="muc-form-container" jid="${jid}"></converse-muc-password-form>` : '' }
            ${ conn_status == RS.ENTERED ? html`<converse-muc-chatarea jid="${jid}"></converse-muc-chatarea>` : '' }
            ${ conn_status == RS.CONNECTING ? tpl_spinner() : '' }
            ${ conn_status == RS.NICKNAME_REQUIRED ? getNicknameRequiredTemplate(o.model) : '' }
            ${ conn_status == RS.DISCONNECTED ? html`<converse-muc-disconnected jid="${jid}"></converse-muc-disconnected>` : '' }
            ${ conn_status == RS.BANNED ? html`<converse-muc-disconnected jid="${jid}"></converse-muc-disconnected>` : '' }
            ${ conn_status == RS.DESTROYED ? html`<converse-muc-destroyed jid="${jid}"></converse-muc-destroyed>` : '' }
        `;
    }
}

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


function verifyAndSetAffiliation (muc, command, args, required_affiliations) {
    const affiliation = COMMAND_TO_AFFILIATION[command];
    if (!affiliation) {
        throw Error(`verifyAffiliations called with invalid command: ${command}`);
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

    setAffiliation(affiliation, muc.get('jid'), [attrs])
        .then(() => muc.occupants.fetchMembers())
        .catch(err => muc.onCommandError(err));
}


export function showModeratorToolsModal (muc, affiliation) {
    if (!muc.verifyRoles(['moderator'])) {
        return;
    }
    let modal = api.modal.get(ModeratorToolsModal.id);
    if (modal) {
        modal.affiliation = affiliation;
        modal.render();
    } else {
        modal = api.modal.create(ModeratorToolsModal, { affiliation, 'jid': muc.get('jid') });
    }
    modal.show();
}


export function showOccupantModal (ev, occupant) {
    api.modal.show(OccupantModal, { 'model': occupant }, ev);
}


export function parseMessageForMUCCommands (data, handled) {
    if (handled || (
            api.settings.get('muc_disable_slash_commands') &&
            !Array.isArray(api.settings.get('muc_disable_slash_commands'))
    )) {
        return handled;
    }

    let text = data.text;
    text = text.replace(/^\s*/, '');
    const command = (text.match(/^\/([a-zA-Z]*) ?/) || ['']).pop().toLowerCase();
    if (!command) {
        return false;
    }

    const model = data.model;
    const args = text.slice(('/' + command).length + 1).trim();
    const allowed_commands = model.getAllowedCommands() ?? [];

    if (command === 'admin' && allowed_commands.includes(command)) {
        verifyAndSetAffiliation(model, command, args, ['owner']);
        return true;
    } else if (command === 'ban' && allowed_commands.includes(command)) {
        verifyAndSetAffiliation(model, command, args, ['admin', 'owner']);
        return true;
    } else if (command === 'modtools' && allowed_commands.includes(command)) {
        showModeratorToolsModal(model, args);
        return true;
    } else if (command === 'deop' && allowed_commands.includes(command)) {
        // FIXME: /deop only applies to setting a moderators
        // role to "participant" (which only admin/owner can
        // do). Moderators can however set non-moderator's role
        // to participant (e.g. visitor => participant).
        // Currently we don't distinguish between these two
        // cases.
        setRole(model, command, args, ['admin', 'owner']);
        return true;
    } else if (command === 'destroy' && allowed_commands.includes(command)) {
        if (!model.verifyAffiliations(['owner'])) {
            return true;
        }
        destroyMUC(model).catch(e => model.onCommandError(e));
        return true;
    } else if (command === 'help' && allowed_commands.includes(command)) {
        model.set({ 'show_help_messages': false }, { 'silent': true });
        model.set({ 'show_help_messages': true });
        return true;
    } else if (command === 'kick' && allowed_commands.includes(command)) {
        setRole(model, command, args, [], ['moderator']);
        return true;
    } else if (command === 'mute' && allowed_commands.includes(command)) {
        setRole(model, command, args, [], ['moderator']);
        return true;
    } else if (command === 'member' && allowed_commands.includes(command)) {
        verifyAndSetAffiliation(model, command, args, ['admin', 'owner']);
        return true;
    } else if (command === 'nick' && allowed_commands.includes(command)) {
        if (!model.verifyRoles(['visitor', 'participant', 'moderator'])) {
            return true;
        } else if (args.length === 0) {
            // e.g. Your nickname is "coolguy69"
            const message = __('Your nickname is "%1$s"', model.get('nick'));
            model.createMessage({ message, 'type': 'error' });
        } else {
            model.setNickname(args);
        }
        return true;
    } else if (command === 'owner' && allowed_commands.includes(command)) {
        verifyAndSetAffiliation(model, command, args, ['owner']);
        return true;
    } else if (command === 'op' && allowed_commands.includes(command)) {
        setRole(model, command, args, ['admin', 'owner']);
        return true;
    } else if (command === 'register' && allowed_commands.includes(command)) {
        if (args.length > 1) {
            model.createMessage({
                'message': __('Error: invalid number of arguments'),
                'type': 'error'
            });
        } else {
            model.registerNickname().then(err_msg => {
                err_msg && model.createMessage({ 'message': err_msg, 'type': 'error' });
            });
        }
        return true;
    } else if (command === 'revoke' && allowed_commands.includes(command)) {
        verifyAndSetAffiliation(model, command, args, ['admin', 'owner']);
        return true;
    } else if (command === 'topic' && allowed_commands.includes(command) ||
            command === 'subject' && allowed_commands.includes(command)) {
        model.setSubject(args);
        return true;
    } else if (command === 'voice' && allowed_commands.includes(command)) {
        setRole(model, command, args, [], ['moderator']);
        return true;
    } else {
        return false;
    }
}
