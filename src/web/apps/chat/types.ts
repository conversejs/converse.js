export type ChatRoute = {
    view: 'list' | 'chat' | 'room';
    jid?: string; // chat: a contact's JID; room: a MUC's JID (omitted for the list)
};
