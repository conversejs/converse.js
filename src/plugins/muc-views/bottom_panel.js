import BottomPanel from 'plugins/chatview/bottom_panel.js';
import debounce from 'lodash/debounce';
import tpl_muc_bottom_panel from './templates/muc_bottom_panel.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { getAutoCompleteListItem } from './utils.js';
import { render } from 'lit-html';

const { Strophe, $pres } = converse.env;


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

const u = converse.env.utils;


export default class MUCBottomPanel extends BottomPanel {

    events = {
        'click .hide-occupants': 'hideOccupants',
        'click .send-button': 'onFormSubmitted',
    }

    async connectedCallback () {
        super.connectedCallback();
        this.debouncedRender = debounce(this.render, 100);
        this.model = _converse.chatboxes.get(this.getAttribute('jid'));
        this.listenTo(this.model, 'change:composing_spoiler', this.renderMessageForm);

        await this.model.initialized;
        this.listenTo(this.model, 'change:hidden_occupants', this.debouncedRender);
        this.listenTo(this.model.features, 'change:moderated', this.debouncedRender);
        this.listenTo(this.model.occupants, 'add', this.renderIfOwnOccupant)
        this.listenTo(this.model.occupants, 'change:role', this.renderIfOwnOccupant);
        this.listenTo(this.model.session, 'change:connection_status', this.debouncedRender);
        this.render();
    }

    render () {
        const entered = this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED;
        const can_edit = entered && !(this.model.features.get('moderated') && this.model.getOwnRole() === 'visitor');
        render(tpl_muc_bottom_panel({ can_edit, entered, 'model': this.model }), this);
        if (entered && can_edit) {
            this.renderMessageForm();
            this.initMentionAutoComplete();
        }
    }

    renderIfOwnOccupant (o) {
        (o.get('jid') === _converse.bare_jid) && this.debouncedRender();
    }

    getToolbarOptions () {
        return Object.assign(super.getToolbarOptions(), {
            'is_groupchat': true,
            'label_hide_occupants': __('Hide the list of participants'),
            'show_occupants_toggle': _converse.visible_toolbar_buttons.toggle_occupants
        });
    }

    getAutoCompleteList () {
        return this.model.getAllKnownNicknames().map(nick => ({ 'label': nick, 'value': `@${nick}` }));
    }

    initMentionAutoComplete () {
        this.mention_auto_complete = new _converse.AutoComplete(this, {
            'auto_first': true,
            'auto_evaluate': false,
            'min_chars': api.settings.get('muc_mention_autocomplete_min_chars'),
            'match_current_word': true,
            'list': () => this.getAutoCompleteList(),
            'filter':
                api.settings.get('muc_mention_autocomplete_filter') == 'contains'
                    ? _converse.FILTER_CONTAINS
                    : _converse.FILTER_STARTSWITH,
            'ac_triggers': ['Tab', '@'],
            'include_triggers': [],
            'item': getAutoCompleteListItem
        });
        this.mention_auto_complete.on('suggestion-box-selectcomplete', () => (this.auto_completing = false));
    }

    /**
     * Hide the right sidebar containing the chat occupants.
     * @private
     * @method _converse.ChatRoomView#hideOccupants
     */
    hideOccupants (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.model.save({ 'hidden_occupants': true });
        _converse.chatboxviews.get(this.getAttribute('jid'))?.scrollDown();
    }

    onKeyDown (ev) {
        if (this.mention_auto_complete.onKeyDown(ev)) {
            return;
        }
        super.onKeyDown(ev);
    }

    onKeyUp (ev) {
        this.mention_auto_complete.evaluate(ev);
        super.onKeyUp(ev);
    }

    setRole (command, args, required_affiliations = [], required_roles = []) {
        /* Check that a command to change a groupchat user's role or
         * affiliation has anough arguments.
         */
        const role = COMMAND_TO_ROLE[command];
        if (!role) {
            throw Error(`ChatRoomView#setRole called with invalid command: ${command}`);
        }
        if (!this.model.verifyAffiliations(required_affiliations) || !this.model.verifyRoles(required_roles)) {
            return false;
        }
        if (!this.model.validateRoleOrAffiliationChangeArgs(command, args)) {
            return false;
        }
        const nick_or_jid = this.model.getNickOrJIDFromCommandArgs(args);
        if (!nick_or_jid) {
            return false;
        }
        const reason = args.split(nick_or_jid, 2)[1].trim();
        // We're guaranteed to have an occupant due to getNickOrJIDFromCommandArgs
        const occupant = this.model.getOccupant(nick_or_jid);
        this.model.setRole(occupant, role, reason, undefined, this.model.onCommandError.bind(this));
        return true;
    }

    setAffiliation (command, args, required_affiliations) {
        const affiliation = COMMAND_TO_AFFILIATION[command];
        if (!affiliation) {
            throw Error(`ChatRoomView#setAffiliation called with invalid command: ${command}`);
        }
        if (!this.model.verifyAffiliations(required_affiliations)) {
            return false;
        }
        if (!this.model.validateRoleOrAffiliationChangeArgs(command, args)) {
            return false;
        }
        const nick_or_jid = this.model.getNickOrJIDFromCommandArgs(args);
        if (!nick_or_jid) {
            return false;
        }

        let jid;
        const reason = args.split(nick_or_jid, 2)[1].trim();
        const occupant = this.model.getOccupant(nick_or_jid);
        if (occupant) {
            jid = occupant.get('jid');
        } else {
            if (u.isValidJID(nick_or_jid)) {
                jid = nick_or_jid;
            } else {
                const message = __(
                    "Couldn't find a participant with that nickname. " + 'They might have left the groupchat.'
                );
                this.model.createMessage({ message, 'type': 'error' });
                return;
            }
        }
        const attrs = { jid, reason };
        if (occupant && api.settings.get('auto_register_muc_nickname')) {
            attrs['nick'] = occupant.get('nick');
        }
        this.model
            .setAffiliation(affiliation, [attrs])
            .then(() => this.model.occupants.fetchMembers())
            .catch(err => this.model.onCommandError(err));
    }


    parseMessageForCommands (text) {
        if (
            api.settings.get('muc_disable_slash_commands') &&
            !Array.isArray(api.settings.get('muc_disable_slash_commands'))
        ) {
            return super.parseMessageForCommands(text);
        }
        text = text.replace(/^\s*/, '');
        const command = (text.match(/^\/([a-zA-Z]*) ?/) || ['']).pop().toLowerCase();
        if (!command) {
            return false;
        }
        const args = text.slice(('/' + command).length + 1).trim();
        if (!this.model.getAllowedCommands().includes(command)) {
            return false;
        }

        switch (command) {
            case 'admin': {
                this.setAffiliation(command, args, ['owner']);
                break;
            }
            case 'ban': {
                this.setAffiliation(command, args, ['admin', 'owner']);
                break;
            }
            case 'modtools': {
                const chatview = _converse.chatboxviews.get(this.getAttribute('jid'));
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
                this.setRole(command, args, ['admin', 'owner']);
                break;
            }
            case 'destroy': {
                if (!this.model.verifyAffiliations(['owner'])) {
                    break;
                }
                const chatview = _converse.chatboxviews.get(this.getAttribute('jid'));
                chatview.destroy().catch(e => this.model.onCommandError(e));
                break;
            }
            case 'help': {
                this.model.set({ 'show_help_messages': true });
                break;
            }
            case 'kick': {
                this.setRole(command, args, [], ['moderator']);
                break;
            }
            case 'mute': {
                this.setRole(command, args, [], ['moderator']);
                break;
            }
            case 'member': {
                this.setAffiliation(command, args, ['admin', 'owner']);
                break;
            }
            case 'nick': {
                if (!this.model.verifyRoles(['visitor', 'participant', 'moderator'])) {
                    break;
                } else if (args.length === 0) {
                    // e.g. Your nickname is "coolguy69"
                    const message = __('Your nickname is "%1$s"', this.model.get('nick'));
                    this.model.createMessage({ message, 'type': 'error' });
                } else {
                    const jid = Strophe.getBareJidFromJid(this.model.get('jid'));
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
                this.setAffiliation(command, args, ['owner']);
                break;
            case 'op': {
                this.setRole(command, args, ['admin', 'owner']);
                break;
            }
            case 'register': {
                if (args.length > 1) {
                    this.model.createMessage({
                        'message': __('Error: invalid number of arguments'),
                        'type': 'error'
                    });
                } else {
                    this.model.registerNickname().then(err_msg => {
                        err_msg && this.model.createMessage({ 'message': err_msg, 'type': 'error' });
                    });
                }
                break;
            }
            case 'revoke': {
                this.setAffiliation(command, args, ['admin', 'owner']);
                break;
            }
            case 'topic':
            case 'subject':
                this.model.setSubject(args);
                break;
            case 'voice': {
                this.setRole(command, args, [], ['moderator']);
                break;
            }
            default:
                return super.parseMessageForCommands(text);
        }
        return true;
    }
}

api.elements.define('converse-muc-bottom-panel', MUCBottomPanel);
