import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import scheduled_messages_api from './api.js';
import ScheduledMessage from './model.js';
import ScheduledMessages from './collection.js';

converse.plugins.add('converse-scheduled-messages', {
    dependencies: ['converse-chat', 'converse-muc'],

    initialize() {
        api.promises.add('scheduledMessagesInitialized');
        Object.assign(api, scheduled_messages_api);
        Object.assign(_converse.exports, { ScheduledMessage, ScheduledMessages });

        api.listen.on('userSessionInitialized', initializeSchedules);
        api.listen.on('connected', resumeSchedules);
        api.listen.on('reconnected', resumeSchedules);
        api.listen.on('disconnected', pauseSchedules);
        api.listen.on('clearSession', clearSession);
    },
});

async function initializeSchedules() {
    const bare_jid = _converse.session.get('bare_jid');
    const schedules = new ScheduledMessages([], {
        id: `converse.scheduled-messages-${bare_jid}`,
        on_due: sendScheduledMessage,
    });
    _converse.state.scheduled_messages = schedules;
    await schedules.hydrated;
    api.trigger('scheduledMessagesInitialized');
}

async function resumeSchedules() {
    await api.waitUntil('scheduledMessagesInitialized');
    await _converse.state.scheduled_messages.resume();
}

function pauseSchedules() {
    _converse.state.scheduled_messages?.pause();
}

function clearSession() {
    pauseSchedules();
    delete _converse.state.scheduled_messages;
    api.promises.add('scheduledMessagesInitialized');
}

/** Let a caller handle policy or other product concerns, then send by default. */
async function sendScheduledMessage(scheduled) {
    const result = await api.hook('scheduledMessageDue', scheduled, { handled: false });
    if (!result.handled) await sendDirect(scheduled);
    api.trigger('scheduledMessageProcessed', { scheduled, result: result.result });
}

async function sendDirect(scheduled) {
    const { to, body } = scheduled.toJSON();
    const room = await api.rooms.get(to);
    if (room) {
        if (!room.isEntered()) throw new Error(`Cannot send scheduled message: not in room ${to}.`);
        await room.sendMessage({ body });
        return;
    }
    const chat = await api.chats.get(to, {}, true);
    await chat.initialized;
    const message = await chat.sendMessage({ body });
    if (!message) throw new Error('Could not build the scheduled message.');
}
