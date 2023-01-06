export default ChatRoomMixin;
declare namespace ChatRoomMixin {
    function defaults(): {
        bookmarked: boolean;
        chat_state: any;
        has_activity: boolean;
        hidden: boolean;
        hidden_occupants: boolean;
        message_type: string;
        name: string;
        num_unread_general: number;
        num_unread: number;
        roomconfig: {};
        time_opened: any;
        time_sent: string;
        type: string;
    };
    function initialize(): Promise<void>;
    function isEntered(): boolean;
    /**
     * Checks whether we're still joined and if so, restores the MUC state from cache.
     * @private
     * @method _converse.ChatRoom#restoreFromCache
     * @returns { Boolean } Returns `true` if we're still joined, otherwise returns `false`.
     */
    function restoreFromCache(): boolean;
    /**
     * Join the MUC
     * @private
     * @method _converse.ChatRoom#join
     * @param { String } nick - The user's nickname
     * @param { String } [password] - Optional password, if required by the groupchat.
     *  Will fall back to the `password` value stored in the room
     *  model (if available).
     */
    function join(nick: string, password?: string): Promise<{
        defaults(): {
            bookmarked: boolean;
            chat_state: any;
            has_activity: boolean;
            hidden: boolean;
            hidden_occupants: boolean;
            message_type: string;
            name: string;
            num_unread_general: number;
            num_unread: number;
            roomconfig: {};
            time_opened: any;
            time_sent: string;
            type: string;
        };
        initialize(): Promise<void>;
        isEntered(): boolean;
        /**
         * Checks whether we're still joined and if so, restores the MUC state from cache.
         * @private
         * @method _converse.ChatRoom#restoreFromCache
         * @returns { Boolean } Returns `true` if we're still joined, otherwise returns `false`.
         */
        restoreFromCache(): boolean;
        join(nick: string, password?: string): Promise<any>;
        /**
         * Clear stale cache and re-join a MUC we've been in before.
         * @private
         * @method _converse.ChatRoom#rejoin
         */
        rejoin(): Promise<any>;
        constructJoinPresence(password: any): Promise<any>;
        clearOccupantsCache(): void;
        /**
         * Given the passed in MUC message, send a XEP-0333 chat marker.
         * @param { _converse.MUCMessage } msg
         * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
         * @param { Boolean } force - Whether a marker should be sent for the
         *  message, even if it didn't include a `markable` element.
         */
        sendMarkerForMessage(msg: _converse.MUCMessage, type?: "received" | "displayed" | "acknowledged", force?: boolean): void;
        /**
         * Ensures that the user is subscribed to XEP-0437 Room Activity Indicators
         * if `muc_subscribe_to_rai` is set to `true`.
         * Only affiliated users can subscribe to RAI, but this method doesn't
         * check whether the current user is affiliated because it's intended to be
         * called after the MUC has been left and we don't have that information
         * anymore.
         * @private
         * @method _converse.ChatRoom#enableRAI
         */
        enableRAI(): void;
        /**
         * Handler that gets called when the 'hidden' flag is toggled.
         * @private
         * @method _converse.ChatRoom#onHiddenChange
         */
        onHiddenChange(): Promise<void>;
        onOccupantAdded(occupant: any): void;
        onOccupantRemoved(occupant: any): void;
        onOccupantShowChanged(occupant: any): void;
        onRoomEntered(): Promise<void>;
        onConnectionStatusChanged(): Promise<void>;
        onReconnection(): Promise<void>;
        getMessagesCollection(): any;
        restoreSession(): Promise<any>;
        initDiscoModels(): void;
        initOccupants(): void;
        fetchOccupants(): any;
        handleAffiliationChangedMessage(stanza: any): void;
        handleErrorMessageStanza(stanza: any): Promise<void>;
        /**
         * Handles incoming message stanzas from the service that hosts this MUC
         * @private
         * @method _converse.ChatRoom#handleMessageFromMUCHost
         * @param { Element } stanza
         */
        handleMessageFromMUCHost(stanza: Element): void;
        /**
         * Handles XEP-0452 MUC Mention Notification messages
         * @private
         * @method _converse.ChatRoom#handleForwardedMentions
         * @param { Element } stanza
         */
        handleForwardedMentions(stanza: Element): void;
        /**
         * Parses an incoming message stanza and queues it for processing.
         * @private
         * @method _converse.ChatRoom#handleMessageStanza
         * @param { Element } stanza
         */
        handleMessageStanza(stanza: Element): Promise<any>;
        /**
         * Register presence and message handlers relevant to this groupchat
         * @private
         * @method _converse.ChatRoom#registerHandlers
         */
        registerHandlers(): void;
        removeHandlers(): any;
        invitesAllowed(): any;
        getDisplayName(): any;
        /**
         * Sends a message stanza to the XMPP server and expects a reflection
         * or error message within a specific timeout period.
         * @private
         * @method _converse.ChatRoom#sendTimedMessage
         * @param { _converse.Message|Element } message
         * @returns { Promise<Element>|Promise<_converse.TimeoutError> } Returns a promise
         *  which resolves with the reflected message stanza or with an error stanza or {@link _converse.TimeoutError}.
         */
        sendTimedMessage(el: any): Promise<Element> | Promise<_converse.TimeoutError>;
        /**
         * Retract one of your messages in this groupchat
         * @private
         * @method _converse.ChatRoom#retractOwnMessage
         * @param { _converse.Message } message - The message which we're retracting.
         */
        retractOwnMessage(message: _converse.Message): Promise<void>;
        /**
         * Retract someone else's message in this groupchat.
         * @private
         * @method _converse.ChatRoom#retractOtherMessage
         * @param { _converse.Message } message - The message which we're retracting.
         * @param { string } [reason] - The reason for retracting the message.
         * @example
         *  const room = await api.rooms.get(jid);
         *  const message = room.messages.findWhere({'body': 'Get rich quick!'});
         *  room.retractOtherMessage(message, 'spam');
         */
        retractOtherMessage(message: _converse.Message, reason?: string): Promise<any>;
        /**
         * Sends an IQ stanza to the XMPP server to retract a message in this groupchat.
         * @private
         * @method _converse.ChatRoom#sendRetractionIQ
         * @param { _converse.Message } message - The message which we're retracting.
         * @param { string } [reason] - The reason for retracting the message.
         */
        sendRetractionIQ(message: _converse.Message, reason?: string): Promise<any>;
        /**
         * Sends an IQ stanza to the XMPP server to destroy this groupchat. Not
         * to be confused with the {@link _converse.ChatRoom#destroy}
         * method, which simply removes the room from the local browser storage cache.
         * @private
         * @method _converse.ChatRoom#sendDestroyIQ
         * @param { string } [reason] - The reason for destroying the groupchat.
         * @param { string } [new_jid] - The JID of the new groupchat which replaces this one.
         */
        sendDestroyIQ(reason?: string, new_jid?: string): Promise<any>;
        /**
         * Leave the groupchat.
         * @private
         * @method _converse.ChatRoom#leave
         * @param { string } [exit_msg] - Message to indicate your reason for leaving
         */
        leave(exit_msg?: string): Promise<void>;
        close(ev: any): Promise<any>;
        canModerateMessages(): any;
        /**
         * Return an array of unique nicknames based on all occupants and messages in this MUC.
         * @private
         * @method _converse.ChatRoom#getAllKnownNicknames
         * @returns { String[] }
         */
        getAllKnownNicknames(): string[];
        getAllKnownNicknamesRegex(): RegExp;
        getOccupantByJID(jid: any): any;
        getOccupantByNickname(nick: any): any;
        getReferenceURIFromNickname(nickname: any): string;
        /**
         * Given a text message, look for `@` mentions and turn them into
         * XEP-0372 references
         * @param { String } text
         */
        parseTextForReferences(text: string): any[];
        getOutgoingMessageAttributes(attrs: any): Promise<any>;
        /**
         * Utility method to construct the JID for the current user as occupant of the groupchat.
         * @private
         * @method _converse.ChatRoom#getRoomJIDAndNick
         * @returns {string} - The groupchat JID with the user's nickname added at the end.
         * @example groupchat@conference.example.org/nickname
         */
        getRoomJIDAndNick(): string;
        /**
         * Sends a message with the current XEP-0085 chat state of the user
         * as taken from the `chat_state` attribute of the {@link _converse.ChatRoom}.
         * @private
         * @method _converse.ChatRoom#sendChatState
         */
        sendChatState(): void;
        /**
         * Send a direct invitation as per XEP-0249
         * @private
         * @method _converse.ChatRoom#directInvite
         * @param { String } recipient - JID of the person being invited
         * @param { String } [reason] - Reason for the invitation
         */
        directInvite(recipient: string, reason?: string): void;
        /**
         * Refresh the disco identity, features and fields for this {@link _converse.ChatRoom}.
         * *features* are stored on the features {@link Model} attribute on this {@link _converse.ChatRoom}.
         * *fields* are stored on the config {@link Model} attribute on this {@link _converse.ChatRoom}.
         * @private
         * @returns {Promise}
         */
        refreshDiscoInfo(): Promise<any>;
        /**
         * Fetch the *extended* MUC info from the server and cache it locally
         * https://xmpp.org/extensions/xep-0045.html#disco-roominfo
         * @private
         * @method _converse.ChatRoom#getDiscoInfo
         * @returns {Promise}
         */
        getDiscoInfo(): Promise<any>;
        /**
         * Fetch the *extended* MUC info fields from the server and store them locally
         * in the `config` {@link Model} attribute.
         * See: https://xmpp.org/extensions/xep-0045.html#disco-roominfo
         * @private
         * @method _converse.ChatRoom#getDiscoInfoFields
         * @returns {Promise}
         */
        getDiscoInfoFields(): Promise<any>;
        /**
         * Use converse-disco to populate the features {@link Model} which
         * is stored as an attibute on this {@link _converse.ChatRoom}.
         * The results may be cached. If you want to force fetching the features from the
         * server, call {@link _converse.ChatRoom#refreshDiscoInfo} instead.
         * @private
         * @returns {Promise}
         */
        getDiscoInfoFeatures(): Promise<any>;
        /**
         * Given a <field> element, return a copy with a <value> child if
         * we can find a value for it in this rooms config.
         * @private
         * @method _converse.ChatRoom#addFieldValue
         * @returns { Element }
         */
        addFieldValue(field: any): Element;
        /**
         * Automatically configure the groupchat based on this model's
         * 'roomconfig' data.
         * @private
         * @method _converse.ChatRoom#autoConfigureChatRoom
         * @returns { Promise<Element> }
         * Returns a promise which resolves once a response IQ has
         * been received.
         */
        autoConfigureChatRoom(): Promise<Element>;
        /**
         * Send an IQ stanza to fetch the groupchat configuration data.
         * Returns a promise which resolves once the response IQ
         * has been received.
         * @private
         * @method _converse.ChatRoom#fetchRoomConfiguration
         * @returns { Promise<Element> }
         */
        fetchRoomConfiguration(): Promise<Element>;
        /**
         * Sends an IQ stanza with the groupchat configuration.
         * @private
         * @method _converse.ChatRoom#sendConfiguration
         * @param { Array } config - The groupchat configuration
         * @returns { Promise<Element> } - A promise which resolves with
         * the `result` stanza received from the XMPP server.
         */
        sendConfiguration(config?: any[]): Promise<Element>;
        onCommandError(err: any): void;
        getNickOrJIDFromCommandArgs(args: any): any;
        validateRoleOrAffiliationChangeArgs(command: any, args: any): boolean;
        getAllowedCommands(): string[];
        verifyAffiliations(affiliations: any, occupant: any, show_error?: boolean): boolean;
        verifyRoles(roles: any, occupant: any, show_error?: boolean): boolean;
        /**
         * Returns the `role` which the current user has in this MUC
         * @private
         * @method _converse.ChatRoom#getOwnRole
         * @returns { ('none'|'visitor'|'participant'|'moderator') }
         */
        getOwnRole(): "none" | "moderator" | "participant" | "visitor";
        /**
         * Returns the `affiliation` which the current user has in this MUC
         * @private
         * @method _converse.ChatRoom#getOwnAffiliation
         * @returns { ('none'|'outcast'|'member'|'admin'|'owner') }
         */
        getOwnAffiliation(): "none" | "admin" | "owner" | "member" | "outcast";
        /**
         * Get the {@link _converse.ChatRoomOccupant} instance which
         * represents the current user.
         * @method _converse.ChatRoom#getOwnOccupant
         * @returns { _converse.ChatRoomOccupant }
         */
        getOwnOccupant(): _converse.ChatRoomOccupant;
        /**
         * Send a presence stanza to update the user's nickname in this MUC.
         * @param { String } nick
         */
        setNickname(nick: string): Promise<void>;
        /**
         * Send an IQ stanza to modify an occupant's role
         * @private
         * @method _converse.ChatRoom#setRole
         * @param { _converse.ChatRoomOccupant } occupant
         * @param { String } role
         * @param { String } reason
         * @param { function } onSuccess - callback for a succesful response
         * @param { function } onError - callback for an error response
         */
        setRole(occupant: _converse.ChatRoomOccupant, role: string, reason: string, onSuccess: Function, onError: Function): Promise<any>;
        /**
         * @private
         * @method _converse.ChatRoom#getOccupant
         * @param { String } nickname_or_jid - The nickname or JID of the occupant to be returned
         * @returns { _converse.ChatRoomOccupant }
         */
        getOccupant(nickname_or_jid: string): _converse.ChatRoomOccupant;
        /**
         * Return an array of occupant models that have the required role
         * @private
         * @method _converse.ChatRoom#getOccupantsWithRole
         * @param { String } role
         * @returns { _converse.ChatRoomOccupant[] }
         */
        getOccupantsWithRole(role: string): _converse.ChatRoomOccupant[];
        /**
         * Return an array of occupant models that have the required affiliation
         * @private
         * @method _converse.ChatRoom#getOccupantsWithAffiliation
         * @param { String } affiliation
         * @returns { _converse.ChatRoomOccupant[] }
         */
        getOccupantsWithAffiliation(affiliation: string): _converse.ChatRoomOccupant[];
        /**
         * Return an array of occupant models, sorted according to the passed-in attribute.
         * @private
         * @method _converse.ChatRoom#getOccupantsSortedBy
         * @param { String } attr - The attribute to sort the returned array by
         * @returns { _converse.ChatRoomOccupant[] }
         */
        getOccupantsSortedBy(attr: string): _converse.ChatRoomOccupant[];
        /**
         * Fetch the lists of users with the given affiliations.
         * Then compute the delta between those users and
         * the passed in members, and if it exists, send the delta
         * to the XMPP server to update the member list.
         * @private
         * @method _converse.ChatRoom#updateMemberLists
         * @param { object } members - Map of member jids and affiliations.
         * @returns { Promise }
         *  A promise which is resolved once the list has been
         *  updated or once it's been established there's no need
         *  to update the list.
         */
        updateMemberLists(members: any): Promise<any>;
        /**
         * Given a nick name, save it to the model state, otherwise, look
         * for a server-side reserved nickname or default configured
         * nickname and if found, persist that to the model state.
         * @private
         * @method _converse.ChatRoom#getAndPersistNickname
         * @returns { Promise<string> } A promise which resolves with the nickname
         */
        getAndPersistNickname(nick: any): Promise<string>;
        /**
         * Use service-discovery to ask the XMPP server whether
         * this user has a reserved nickname for this groupchat.
         * If so, we'll use that, otherwise we render the nickname form.
         * @private
         * @method _converse.ChatRoom#getReservedNick
         * @returns { Promise<string> } A promise which resolves with the reserved nick or null
         */
        getReservedNick(): Promise<string>;
        /**
         * Send an IQ stanza to the MUC to register this user's nickname.
         * This sets the user's affiliation to 'member' (if they weren't affiliated
         * before) and reserves the nickname for this user, thereby preventing other
         * users from using it in this MUC.
         * See https://xmpp.org/extensions/xep-0045.html#register
         * @private
         * @method _converse.ChatRoom#registerNickname
         */
        registerNickname(): Promise<any>;
        /**
         * Check whether we should unregister the user from this MUC, and if so,
         * call { @link _converse.ChatRoom#sendUnregistrationIQ }
         * @method _converse.ChatRoom#unregisterNickname
         */
        unregisterNickname(): Promise<void>;
        /**
         * Send an IQ stanza to the MUC to unregister this user's nickname.
         * If the user had a 'member' affiliation, it'll be removed and their
         * nickname will no longer be reserved and can instead be used (and
         * registered) by other users.
         * @method _converse.ChatRoom#sendUnregistrationIQ
         */
        sendUnregistrationIQ(): Promise<any>;
        /**
         * Given a presence stanza, update the occupant model based on its contents.
         * @private
         * @method _converse.ChatRoom#updateOccupantsOnPresence
         * @param { Element } pres - The presence stanza
         */
        updateOccupantsOnPresence(pres: Element): boolean;
        fetchFeaturesIfConfigurationChanged(stanza: any): void;
        /**
         * Given two JIDs, which can be either user JIDs or MUC occupant JIDs,
         * determine whether they belong to the same user.
         * @private
         * @method _converse.ChatRoom#isSameUser
         * @param { String } jid1
         * @param { String } jid2
         * @returns { Boolean }
         */
        isSameUser(jid1: string, jid2: string): boolean;
        isSubjectHidden(): Promise<any>;
        toggleSubjectHiddenState(): Promise<void>;
        /**
         * Handle a possible subject change and return `true` if so.
         * @private
         * @method _converse.ChatRoom#handleSubjectChange
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         */
        handleSubjectChange(attrs: any): Promise<boolean>;
        /**
         * Set the subject for this {@link _converse.ChatRoom}
         * @private
         * @method _converse.ChatRoom#setSubject
         * @param { String } value
         */
        setSubject(value?: string): void;
        /**
         * Is this a chat state notification that can be ignored,
         * because it's old or because it's from us.
         * @private
         * @method _converse.ChatRoom#ignorableCSN
         * @param { Object } attrs - The message attributes
         */
        ignorableCSN(attrs: any): any;
        /**
         * Determines whether the message is from ourselves by checking
         * the `from` attribute. Doesn't check the `type` attribute.
         * @private
         * @method _converse.ChatRoom#isOwnMessage
         * @param { Object|Element|_converse.Message } msg
         * @returns { boolean }
         */
        isOwnMessage(msg: any): boolean;
        getUpdatedMessageAttributes(message: any, attrs: any): any;
        /**
         * Send a MUC-0410 MUC Self-Ping stanza to room to determine
         * whether we're still joined.
         * @async
         * @private
         * @method _converse.ChatRoom#isJoined
         * @returns {Promise<boolean>}
         */
        isJoined(): Promise<boolean>;
        /**
         * Sends a status update presence (i.e. based on the `<show>` element)
         * @method _converse.ChatRoom#sendStatusPresence
         * @param { String } type
         * @param { String } [status] - An optional status message
         * @param { Element[]|Strophe.Builder[]|Element|Strophe.Builder } [child_nodes]
         *  Nodes(s) to be added as child nodes of the `presence` XML element.
         */
        sendStatusPresence(type: string, status?: string, child_nodes?: any): Promise<void>;
        /**
         * Check whether we're still joined and re-join if not
         * @async
         * @method _converse.ChatRoom#rejoinIfNecessary
         */
        rejoinIfNecessary(): Promise<boolean>;
        /**
         * @private
         * @method _converse.ChatRoom#shouldShowErrorMessage
         * @returns {Promise<boolean>}
         */
        shouldShowErrorMessage(attrs: any): Promise<boolean>;
        /**
         * Looks whether we already have a moderation message for this
         * incoming message. If so, it's considered "dangling" because
         * it probably hasn't been applied to anything yet, given that
         * the relevant message is only coming in now.
         * @private
         * @method _converse.ChatRoom#findDanglingModeration
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         * @returns { _converse.ChatRoomMessage }
         */
        findDanglingModeration(attrs: any): _converse.ChatRoomMessage;
        /**
         * Handles message moderation based on the passed in attributes.
         * @private
         * @method _converse.ChatRoom#handleModeration
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         * @returns { Boolean } Returns `true` or `false` depending on
         *  whether a message was moderated or not.
         */
        handleModeration(attrs: any): boolean;
        getNotificationsText(): any;
        /**
         * @param {String} actor - The nickname of the actor that caused the notification
         * @param {String|Array<String>} states - The state or states representing the type of notificcation
         */
        removeNotification(actor: string, states: string | string[]): void;
        /**
         * Update the notifications model by adding the passed in nickname
         * to the array of nicknames that all match a particular state.
         *
         * Removes the nickname from any other states it might be associated with.
         *
         * The state can be a XEP-0085 Chat State or a XEP-0045 join/leave
         * state.
         * @param {String} actor - The nickname of the actor that causes the notification
         * @param {String} state - The state representing the type of notificcation
         */
        updateNotifications(actor: string, state: string): void;
        handleMetadataFastening(attrs: any): boolean;
        /**
         * Given {@link MessageAttributes} look for XEP-0316 Room Notifications and create info
         * messages for them.
         * @param { Element } stanza
         */
        handleMEPNotification(attrs: any): boolean;
        /**
         * Returns an already cached message (if it exists) based on the
         * passed in attributes map.
         * @method _converse.ChatRoom#getDuplicateMessage
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         * @returns {Promise<_converse.Message>}
         */
        getDuplicateMessage(attrs: any): Promise<_converse.Message>;
        /**
         * Handler for all MUC messages sent to this groupchat. This method
         * shouldn't be called directly, instead {@link _converse.ChatRoom#queueMessage}
         * should be called.
         * @method _converse.ChatRoom#onMessage
         * @param { MessageAttributes } attrs - A promise which resolves to the message attributes.
         */
        onMessage(attrs: MessageAttributes): Promise<void>;
        handleModifyError(pres: any): void;
        /**
         * Handle a presence stanza that disconnects the user from the MUC
         * @param { Element } stanza
         */
        handleDisconnection(stanza: Element): void;
        getActionInfoMessage(code: any, nick: any, actor: any): any;
        createAffiliationChangeMessage(occupant: any): void;
        createRoleChangeMessage(occupant: any, changed: any): void;
        /**
         * Create an info message based on a received MUC status code
         * @private
         * @method _converse.ChatRoom#createInfoMessage
         * @param { string } code - The MUC status code
         * @param { Element } stanza - The original stanza that contains the code
         * @param { Boolean } is_self - Whether this stanza refers to our own presence
         */
        createInfoMessage(code: string, stanza: Element, is_self: boolean): void;
        /**
         * Create info messages based on a received presence or message stanza
         * @private
         * @method _converse.ChatRoom#createInfoMessages
         * @param { Element } stanza
         */
        createInfoMessages(stanza: Element): void;
        /**
         * Set parameters regarding disconnection from this room. This helps to
         * communicate to the user why they were disconnected.
         * @param { String } message - The disconnection message, as received from (or
         *  implied by) the server.
         * @param { String } reason - The reason provided for the disconnection
         * @param { String } actor - The person (if any) responsible for this disconnection
         * @param { Integer } status - The status code (see `ROOMSTATUS`)
         */
        setDisconnectionState(message: string, reason: string, actor: string, status?: Integer): void;
        onNicknameClash(presence: any): void;
        /**
         * Parses a <presence> stanza with type "error" and sets the proper
         * `connection_status` value for this {@link _converse.ChatRoom} as
         * well as any additional output that can be shown to the user.
         * @private
         * @param { Element } stanza - The presence stanza
         */
        onErrorPresence(stanza: Element): void;
        /**
         * Listens for incoming presence stanzas from the service that hosts this MUC
         * @private
         * @method _converse.ChatRoom#onPresenceFromMUCHost
         * @param { Element } stanza - The presence stanza
         */
        onPresenceFromMUCHost(stanza: Element): void;
        /**
         * Handles incoming presence stanzas coming from the MUC
         * @private
         * @method _converse.ChatRoom#onPresence
         * @param { Element } stanza
         */
        onPresence(stanza: Element): void;
        /**
         * Handles a received presence relating to the current user.
         *
         * For locked groupchats (which are by definition "new"), the
         * groupchat will either be auto-configured or created instantly
         * (with default config) or a configuration groupchat will be
         * rendered.
         *
         * If the groupchat is not locked, then the groupchat will be
         * auto-configured only if applicable and if the current
         * user is the groupchat's owner.
         * @private
         * @method _converse.ChatRoom#onOwnPresence
         * @param { Element } pres - The stanza
         */
        onOwnPresence(stanza: any): Promise<void>;
        /**
         * Returns a boolean to indicate whether the current user
         * was mentioned in a message.
         * @private
         * @method _converse.ChatRoom#isUserMentioned
         * @param { String } - The text message
         */
        isUserMentioned(message: any): any;
        incrementUnreadMsgsCounter(message: any): void;
        clearUnreadMsgCounter(): void;
    }>;
    /**
     * Clear stale cache and re-join a MUC we've been in before.
     * @private
     * @method _converse.ChatRoom#rejoin
     */
    function rejoin(): Promise<{
        defaults(): {
            bookmarked: boolean;
            chat_state: any;
            has_activity: boolean;
            hidden: boolean;
            hidden_occupants: boolean;
            message_type: string;
            name: string;
            num_unread_general: number;
            num_unread: number;
            roomconfig: {};
            time_opened: any;
            time_sent: string;
            type: string;
        };
        initialize(): Promise<void>;
        isEntered(): boolean;
        /**
         * Checks whether we're still joined and if so, restores the MUC state from cache.
         * @private
         * @method _converse.ChatRoom#restoreFromCache
         * @returns { Boolean } Returns `true` if we're still joined, otherwise returns `false`.
         */
        restoreFromCache(): boolean;
        /**
         * Join the MUC
         * @private
         * @method _converse.ChatRoom#join
         * @param { String } nick - The user's nickname
         * @param { String } [password] - Optional password, if required by the groupchat.
         *  Will fall back to the `password` value stored in the room
         *  model (if available).
         */
        join(nick: string, password?: string): Promise<any>;
        rejoin(): Promise<any>;
        constructJoinPresence(password: any): Promise<any>;
        clearOccupantsCache(): void;
        /**
         * Given the passed in MUC message, send a XEP-0333 chat marker.
         * @param { _converse.MUCMessage } msg
         * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
         * @param { Boolean } force - Whether a marker should be sent for the
         *  message, even if it didn't include a `markable` element.
         */
        sendMarkerForMessage(msg: _converse.MUCMessage, type?: "received" | "displayed" | "acknowledged", force?: boolean): void;
        /**
         * Ensures that the user is subscribed to XEP-0437 Room Activity Indicators
         * if `muc_subscribe_to_rai` is set to `true`.
         * Only affiliated users can subscribe to RAI, but this method doesn't
         * check whether the current user is affiliated because it's intended to be
         * called after the MUC has been left and we don't have that information
         * anymore.
         * @private
         * @method _converse.ChatRoom#enableRAI
         */
        enableRAI(): void;
        /**
         * Handler that gets called when the 'hidden' flag is toggled.
         * @private
         * @method _converse.ChatRoom#onHiddenChange
         */
        onHiddenChange(): Promise<void>;
        onOccupantAdded(occupant: any): void;
        onOccupantRemoved(occupant: any): void;
        onOccupantShowChanged(occupant: any): void;
        onRoomEntered(): Promise<void>;
        onConnectionStatusChanged(): Promise<void>;
        onReconnection(): Promise<void>;
        getMessagesCollection(): any;
        restoreSession(): Promise<any>;
        initDiscoModels(): void;
        initOccupants(): void;
        fetchOccupants(): any;
        handleAffiliationChangedMessage(stanza: any): void;
        handleErrorMessageStanza(stanza: any): Promise<void>;
        /**
         * Handles incoming message stanzas from the service that hosts this MUC
         * @private
         * @method _converse.ChatRoom#handleMessageFromMUCHost
         * @param { Element } stanza
         */
        handleMessageFromMUCHost(stanza: Element): void;
        /**
         * Handles XEP-0452 MUC Mention Notification messages
         * @private
         * @method _converse.ChatRoom#handleForwardedMentions
         * @param { Element } stanza
         */
        handleForwardedMentions(stanza: Element): void;
        /**
         * Parses an incoming message stanza and queues it for processing.
         * @private
         * @method _converse.ChatRoom#handleMessageStanza
         * @param { Element } stanza
         */
        handleMessageStanza(stanza: Element): Promise<any>;
        /**
         * Register presence and message handlers relevant to this groupchat
         * @private
         * @method _converse.ChatRoom#registerHandlers
         */
        registerHandlers(): void;
        removeHandlers(): any;
        invitesAllowed(): any;
        getDisplayName(): any;
        /**
         * Sends a message stanza to the XMPP server and expects a reflection
         * or error message within a specific timeout period.
         * @private
         * @method _converse.ChatRoom#sendTimedMessage
         * @param { _converse.Message|Element } message
         * @returns { Promise<Element>|Promise<_converse.TimeoutError> } Returns a promise
         *  which resolves with the reflected message stanza or with an error stanza or {@link _converse.TimeoutError}.
         */
        sendTimedMessage(el: any): Promise<Element> | Promise<_converse.TimeoutError>;
        /**
         * Retract one of your messages in this groupchat
         * @private
         * @method _converse.ChatRoom#retractOwnMessage
         * @param { _converse.Message } message - The message which we're retracting.
         */
        retractOwnMessage(message: _converse.Message): Promise<void>;
        /**
         * Retract someone else's message in this groupchat.
         * @private
         * @method _converse.ChatRoom#retractOtherMessage
         * @param { _converse.Message } message - The message which we're retracting.
         * @param { string } [reason] - The reason for retracting the message.
         * @example
         *  const room = await api.rooms.get(jid);
         *  const message = room.messages.findWhere({'body': 'Get rich quick!'});
         *  room.retractOtherMessage(message, 'spam');
         */
        retractOtherMessage(message: _converse.Message, reason?: string): Promise<any>;
        /**
         * Sends an IQ stanza to the XMPP server to retract a message in this groupchat.
         * @private
         * @method _converse.ChatRoom#sendRetractionIQ
         * @param { _converse.Message } message - The message which we're retracting.
         * @param { string } [reason] - The reason for retracting the message.
         */
        sendRetractionIQ(message: _converse.Message, reason?: string): Promise<any>;
        /**
         * Sends an IQ stanza to the XMPP server to destroy this groupchat. Not
         * to be confused with the {@link _converse.ChatRoom#destroy}
         * method, which simply removes the room from the local browser storage cache.
         * @private
         * @method _converse.ChatRoom#sendDestroyIQ
         * @param { string } [reason] - The reason for destroying the groupchat.
         * @param { string } [new_jid] - The JID of the new groupchat which replaces this one.
         */
        sendDestroyIQ(reason?: string, new_jid?: string): Promise<any>;
        /**
         * Leave the groupchat.
         * @private
         * @method _converse.ChatRoom#leave
         * @param { string } [exit_msg] - Message to indicate your reason for leaving
         */
        leave(exit_msg?: string): Promise<void>;
        close(ev: any): Promise<any>;
        canModerateMessages(): any;
        /**
         * Return an array of unique nicknames based on all occupants and messages in this MUC.
         * @private
         * @method _converse.ChatRoom#getAllKnownNicknames
         * @returns { String[] }
         */
        getAllKnownNicknames(): string[];
        getAllKnownNicknamesRegex(): RegExp;
        getOccupantByJID(jid: any): any;
        getOccupantByNickname(nick: any): any;
        getReferenceURIFromNickname(nickname: any): string;
        /**
         * Given a text message, look for `@` mentions and turn them into
         * XEP-0372 references
         * @param { String } text
         */
        parseTextForReferences(text: string): any[];
        getOutgoingMessageAttributes(attrs: any): Promise<any>;
        /**
         * Utility method to construct the JID for the current user as occupant of the groupchat.
         * @private
         * @method _converse.ChatRoom#getRoomJIDAndNick
         * @returns {string} - The groupchat JID with the user's nickname added at the end.
         * @example groupchat@conference.example.org/nickname
         */
        getRoomJIDAndNick(): string;
        /**
         * Sends a message with the current XEP-0085 chat state of the user
         * as taken from the `chat_state` attribute of the {@link _converse.ChatRoom}.
         * @private
         * @method _converse.ChatRoom#sendChatState
         */
        sendChatState(): void;
        /**
         * Send a direct invitation as per XEP-0249
         * @private
         * @method _converse.ChatRoom#directInvite
         * @param { String } recipient - JID of the person being invited
         * @param { String } [reason] - Reason for the invitation
         */
        directInvite(recipient: string, reason?: string): void;
        /**
         * Refresh the disco identity, features and fields for this {@link _converse.ChatRoom}.
         * *features* are stored on the features {@link Model} attribute on this {@link _converse.ChatRoom}.
         * *fields* are stored on the config {@link Model} attribute on this {@link _converse.ChatRoom}.
         * @private
         * @returns {Promise}
         */
        refreshDiscoInfo(): Promise<any>;
        /**
         * Fetch the *extended* MUC info from the server and cache it locally
         * https://xmpp.org/extensions/xep-0045.html#disco-roominfo
         * @private
         * @method _converse.ChatRoom#getDiscoInfo
         * @returns {Promise}
         */
        getDiscoInfo(): Promise<any>;
        /**
         * Fetch the *extended* MUC info fields from the server and store them locally
         * in the `config` {@link Model} attribute.
         * See: https://xmpp.org/extensions/xep-0045.html#disco-roominfo
         * @private
         * @method _converse.ChatRoom#getDiscoInfoFields
         * @returns {Promise}
         */
        getDiscoInfoFields(): Promise<any>;
        /**
         * Use converse-disco to populate the features {@link Model} which
         * is stored as an attibute on this {@link _converse.ChatRoom}.
         * The results may be cached. If you want to force fetching the features from the
         * server, call {@link _converse.ChatRoom#refreshDiscoInfo} instead.
         * @private
         * @returns {Promise}
         */
        getDiscoInfoFeatures(): Promise<any>;
        /**
         * Given a <field> element, return a copy with a <value> child if
         * we can find a value for it in this rooms config.
         * @private
         * @method _converse.ChatRoom#addFieldValue
         * @returns { Element }
         */
        addFieldValue(field: any): Element;
        /**
         * Automatically configure the groupchat based on this model's
         * 'roomconfig' data.
         * @private
         * @method _converse.ChatRoom#autoConfigureChatRoom
         * @returns { Promise<Element> }
         * Returns a promise which resolves once a response IQ has
         * been received.
         */
        autoConfigureChatRoom(): Promise<Element>;
        /**
         * Send an IQ stanza to fetch the groupchat configuration data.
         * Returns a promise which resolves once the response IQ
         * has been received.
         * @private
         * @method _converse.ChatRoom#fetchRoomConfiguration
         * @returns { Promise<Element> }
         */
        fetchRoomConfiguration(): Promise<Element>;
        /**
         * Sends an IQ stanza with the groupchat configuration.
         * @private
         * @method _converse.ChatRoom#sendConfiguration
         * @param { Array } config - The groupchat configuration
         * @returns { Promise<Element> } - A promise which resolves with
         * the `result` stanza received from the XMPP server.
         */
        sendConfiguration(config?: any[]): Promise<Element>;
        onCommandError(err: any): void;
        getNickOrJIDFromCommandArgs(args: any): any;
        validateRoleOrAffiliationChangeArgs(command: any, args: any): boolean;
        getAllowedCommands(): string[];
        verifyAffiliations(affiliations: any, occupant: any, show_error?: boolean): boolean;
        verifyRoles(roles: any, occupant: any, show_error?: boolean): boolean;
        /**
         * Returns the `role` which the current user has in this MUC
         * @private
         * @method _converse.ChatRoom#getOwnRole
         * @returns { ('none'|'visitor'|'participant'|'moderator') }
         */
        getOwnRole(): "none" | "moderator" | "participant" | "visitor";
        /**
         * Returns the `affiliation` which the current user has in this MUC
         * @private
         * @method _converse.ChatRoom#getOwnAffiliation
         * @returns { ('none'|'outcast'|'member'|'admin'|'owner') }
         */
        getOwnAffiliation(): "none" | "admin" | "owner" | "member" | "outcast";
        /**
         * Get the {@link _converse.ChatRoomOccupant} instance which
         * represents the current user.
         * @method _converse.ChatRoom#getOwnOccupant
         * @returns { _converse.ChatRoomOccupant }
         */
        getOwnOccupant(): _converse.ChatRoomOccupant;
        /**
         * Send a presence stanza to update the user's nickname in this MUC.
         * @param { String } nick
         */
        setNickname(nick: string): Promise<void>;
        /**
         * Send an IQ stanza to modify an occupant's role
         * @private
         * @method _converse.ChatRoom#setRole
         * @param { _converse.ChatRoomOccupant } occupant
         * @param { String } role
         * @param { String } reason
         * @param { function } onSuccess - callback for a succesful response
         * @param { function } onError - callback for an error response
         */
        setRole(occupant: _converse.ChatRoomOccupant, role: string, reason: string, onSuccess: Function, onError: Function): Promise<any>;
        /**
         * @private
         * @method _converse.ChatRoom#getOccupant
         * @param { String } nickname_or_jid - The nickname or JID of the occupant to be returned
         * @returns { _converse.ChatRoomOccupant }
         */
        getOccupant(nickname_or_jid: string): _converse.ChatRoomOccupant;
        /**
         * Return an array of occupant models that have the required role
         * @private
         * @method _converse.ChatRoom#getOccupantsWithRole
         * @param { String } role
         * @returns { _converse.ChatRoomOccupant[] }
         */
        getOccupantsWithRole(role: string): _converse.ChatRoomOccupant[];
        /**
         * Return an array of occupant models that have the required affiliation
         * @private
         * @method _converse.ChatRoom#getOccupantsWithAffiliation
         * @param { String } affiliation
         * @returns { _converse.ChatRoomOccupant[] }
         */
        getOccupantsWithAffiliation(affiliation: string): _converse.ChatRoomOccupant[];
        /**
         * Return an array of occupant models, sorted according to the passed-in attribute.
         * @private
         * @method _converse.ChatRoom#getOccupantsSortedBy
         * @param { String } attr - The attribute to sort the returned array by
         * @returns { _converse.ChatRoomOccupant[] }
         */
        getOccupantsSortedBy(attr: string): _converse.ChatRoomOccupant[];
        /**
         * Fetch the lists of users with the given affiliations.
         * Then compute the delta between those users and
         * the passed in members, and if it exists, send the delta
         * to the XMPP server to update the member list.
         * @private
         * @method _converse.ChatRoom#updateMemberLists
         * @param { object } members - Map of member jids and affiliations.
         * @returns { Promise }
         *  A promise which is resolved once the list has been
         *  updated or once it's been established there's no need
         *  to update the list.
         */
        updateMemberLists(members: any): Promise<any>;
        /**
         * Given a nick name, save it to the model state, otherwise, look
         * for a server-side reserved nickname or default configured
         * nickname and if found, persist that to the model state.
         * @private
         * @method _converse.ChatRoom#getAndPersistNickname
         * @returns { Promise<string> } A promise which resolves with the nickname
         */
        getAndPersistNickname(nick: any): Promise<string>;
        /**
         * Use service-discovery to ask the XMPP server whether
         * this user has a reserved nickname for this groupchat.
         * If so, we'll use that, otherwise we render the nickname form.
         * @private
         * @method _converse.ChatRoom#getReservedNick
         * @returns { Promise<string> } A promise which resolves with the reserved nick or null
         */
        getReservedNick(): Promise<string>;
        /**
         * Send an IQ stanza to the MUC to register this user's nickname.
         * This sets the user's affiliation to 'member' (if they weren't affiliated
         * before) and reserves the nickname for this user, thereby preventing other
         * users from using it in this MUC.
         * See https://xmpp.org/extensions/xep-0045.html#register
         * @private
         * @method _converse.ChatRoom#registerNickname
         */
        registerNickname(): Promise<any>;
        /**
         * Check whether we should unregister the user from this MUC, and if so,
         * call { @link _converse.ChatRoom#sendUnregistrationIQ }
         * @method _converse.ChatRoom#unregisterNickname
         */
        unregisterNickname(): Promise<void>;
        /**
         * Send an IQ stanza to the MUC to unregister this user's nickname.
         * If the user had a 'member' affiliation, it'll be removed and their
         * nickname will no longer be reserved and can instead be used (and
         * registered) by other users.
         * @method _converse.ChatRoom#sendUnregistrationIQ
         */
        sendUnregistrationIQ(): Promise<any>;
        /**
         * Given a presence stanza, update the occupant model based on its contents.
         * @private
         * @method _converse.ChatRoom#updateOccupantsOnPresence
         * @param { Element } pres - The presence stanza
         */
        updateOccupantsOnPresence(pres: Element): boolean;
        fetchFeaturesIfConfigurationChanged(stanza: any): void;
        /**
         * Given two JIDs, which can be either user JIDs or MUC occupant JIDs,
         * determine whether they belong to the same user.
         * @private
         * @method _converse.ChatRoom#isSameUser
         * @param { String } jid1
         * @param { String } jid2
         * @returns { Boolean }
         */
        isSameUser(jid1: string, jid2: string): boolean;
        isSubjectHidden(): Promise<any>;
        toggleSubjectHiddenState(): Promise<void>;
        /**
         * Handle a possible subject change and return `true` if so.
         * @private
         * @method _converse.ChatRoom#handleSubjectChange
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         */
        handleSubjectChange(attrs: any): Promise<boolean>;
        /**
         * Set the subject for this {@link _converse.ChatRoom}
         * @private
         * @method _converse.ChatRoom#setSubject
         * @param { String } value
         */
        setSubject(value?: string): void;
        /**
         * Is this a chat state notification that can be ignored,
         * because it's old or because it's from us.
         * @private
         * @method _converse.ChatRoom#ignorableCSN
         * @param { Object } attrs - The message attributes
         */
        ignorableCSN(attrs: any): any;
        /**
         * Determines whether the message is from ourselves by checking
         * the `from` attribute. Doesn't check the `type` attribute.
         * @private
         * @method _converse.ChatRoom#isOwnMessage
         * @param { Object|Element|_converse.Message } msg
         * @returns { boolean }
         */
        isOwnMessage(msg: any): boolean;
        getUpdatedMessageAttributes(message: any, attrs: any): any;
        /**
         * Send a MUC-0410 MUC Self-Ping stanza to room to determine
         * whether we're still joined.
         * @async
         * @private
         * @method _converse.ChatRoom#isJoined
         * @returns {Promise<boolean>}
         */
        isJoined(): Promise<boolean>;
        /**
         * Sends a status update presence (i.e. based on the `<show>` element)
         * @method _converse.ChatRoom#sendStatusPresence
         * @param { String } type
         * @param { String } [status] - An optional status message
         * @param { Element[]|Strophe.Builder[]|Element|Strophe.Builder } [child_nodes]
         *  Nodes(s) to be added as child nodes of the `presence` XML element.
         */
        sendStatusPresence(type: string, status?: string, child_nodes?: any): Promise<void>;
        /**
         * Check whether we're still joined and re-join if not
         * @async
         * @method _converse.ChatRoom#rejoinIfNecessary
         */
        rejoinIfNecessary(): Promise<boolean>;
        /**
         * @private
         * @method _converse.ChatRoom#shouldShowErrorMessage
         * @returns {Promise<boolean>}
         */
        shouldShowErrorMessage(attrs: any): Promise<boolean>;
        /**
         * Looks whether we already have a moderation message for this
         * incoming message. If so, it's considered "dangling" because
         * it probably hasn't been applied to anything yet, given that
         * the relevant message is only coming in now.
         * @private
         * @method _converse.ChatRoom#findDanglingModeration
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         * @returns { _converse.ChatRoomMessage }
         */
        findDanglingModeration(attrs: any): _converse.ChatRoomMessage;
        /**
         * Handles message moderation based on the passed in attributes.
         * @private
         * @method _converse.ChatRoom#handleModeration
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         * @returns { Boolean } Returns `true` or `false` depending on
         *  whether a message was moderated or not.
         */
        handleModeration(attrs: any): boolean;
        getNotificationsText(): any;
        /**
         * @param {String} actor - The nickname of the actor that caused the notification
         * @param {String|Array<String>} states - The state or states representing the type of notificcation
         */
        removeNotification(actor: string, states: string | string[]): void;
        /**
         * Update the notifications model by adding the passed in nickname
         * to the array of nicknames that all match a particular state.
         *
         * Removes the nickname from any other states it might be associated with.
         *
         * The state can be a XEP-0085 Chat State or a XEP-0045 join/leave
         * state.
         * @param {String} actor - The nickname of the actor that causes the notification
         * @param {String} state - The state representing the type of notificcation
         */
        updateNotifications(actor: string, state: string): void;
        handleMetadataFastening(attrs: any): boolean;
        /**
         * Given {@link MessageAttributes} look for XEP-0316 Room Notifications and create info
         * messages for them.
         * @param { Element } stanza
         */
        handleMEPNotification(attrs: any): boolean;
        /**
         * Returns an already cached message (if it exists) based on the
         * passed in attributes map.
         * @method _converse.ChatRoom#getDuplicateMessage
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         * @returns {Promise<_converse.Message>}
         */
        getDuplicateMessage(attrs: any): Promise<_converse.Message>;
        /**
         * Handler for all MUC messages sent to this groupchat. This method
         * shouldn't be called directly, instead {@link _converse.ChatRoom#queueMessage}
         * should be called.
         * @method _converse.ChatRoom#onMessage
         * @param { MessageAttributes } attrs - A promise which resolves to the message attributes.
         */
        onMessage(attrs: MessageAttributes): Promise<void>;
        handleModifyError(pres: any): void;
        /**
         * Handle a presence stanza that disconnects the user from the MUC
         * @param { Element } stanza
         */
        handleDisconnection(stanza: Element): void;
        getActionInfoMessage(code: any, nick: any, actor: any): any;
        createAffiliationChangeMessage(occupant: any): void;
        createRoleChangeMessage(occupant: any, changed: any): void;
        /**
         * Create an info message based on a received MUC status code
         * @private
         * @method _converse.ChatRoom#createInfoMessage
         * @param { string } code - The MUC status code
         * @param { Element } stanza - The original stanza that contains the code
         * @param { Boolean } is_self - Whether this stanza refers to our own presence
         */
        createInfoMessage(code: string, stanza: Element, is_self: boolean): void;
        /**
         * Create info messages based on a received presence or message stanza
         * @private
         * @method _converse.ChatRoom#createInfoMessages
         * @param { Element } stanza
         */
        createInfoMessages(stanza: Element): void;
        /**
         * Set parameters regarding disconnection from this room. This helps to
         * communicate to the user why they were disconnected.
         * @param { String } message - The disconnection message, as received from (or
         *  implied by) the server.
         * @param { String } reason - The reason provided for the disconnection
         * @param { String } actor - The person (if any) responsible for this disconnection
         * @param { Integer } status - The status code (see `ROOMSTATUS`)
         */
        setDisconnectionState(message: string, reason: string, actor: string, status?: Integer): void;
        onNicknameClash(presence: any): void;
        /**
         * Parses a <presence> stanza with type "error" and sets the proper
         * `connection_status` value for this {@link _converse.ChatRoom} as
         * well as any additional output that can be shown to the user.
         * @private
         * @param { Element } stanza - The presence stanza
         */
        onErrorPresence(stanza: Element): void;
        /**
         * Listens for incoming presence stanzas from the service that hosts this MUC
         * @private
         * @method _converse.ChatRoom#onPresenceFromMUCHost
         * @param { Element } stanza - The presence stanza
         */
        onPresenceFromMUCHost(stanza: Element): void;
        /**
         * Handles incoming presence stanzas coming from the MUC
         * @private
         * @method _converse.ChatRoom#onPresence
         * @param { Element } stanza
         */
        onPresence(stanza: Element): void;
        /**
         * Handles a received presence relating to the current user.
         *
         * For locked groupchats (which are by definition "new"), the
         * groupchat will either be auto-configured or created instantly
         * (with default config) or a configuration groupchat will be
         * rendered.
         *
         * If the groupchat is not locked, then the groupchat will be
         * auto-configured only if applicable and if the current
         * user is the groupchat's owner.
         * @private
         * @method _converse.ChatRoom#onOwnPresence
         * @param { Element } pres - The stanza
         */
        onOwnPresence(stanza: any): Promise<void>;
        /**
         * Returns a boolean to indicate whether the current user
         * was mentioned in a message.
         * @private
         * @method _converse.ChatRoom#isUserMentioned
         * @param { String } - The text message
         */
        isUserMentioned(message: any): any;
        incrementUnreadMsgsCounter(message: any): void;
        clearUnreadMsgCounter(): void;
    }>;
    function constructJoinPresence(password: any): Promise<any>;
    function clearOccupantsCache(): void;
    /**
     * Given the passed in MUC message, send a XEP-0333 chat marker.
     * @param { _converse.MUCMessage } msg
     * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
     * @param { Boolean } force - Whether a marker should be sent for the
     *  message, even if it didn't include a `markable` element.
     */
    function sendMarkerForMessage(msg: _converse.MUCMessage, type?: "received" | "displayed" | "acknowledged", force?: boolean): void;
    /**
     * Ensures that the user is subscribed to XEP-0437 Room Activity Indicators
     * if `muc_subscribe_to_rai` is set to `true`.
     * Only affiliated users can subscribe to RAI, but this method doesn't
     * check whether the current user is affiliated because it's intended to be
     * called after the MUC has been left and we don't have that information
     * anymore.
     * @private
     * @method _converse.ChatRoom#enableRAI
     */
    function enableRAI(): void;
    /**
     * Handler that gets called when the 'hidden' flag is toggled.
     * @private
     * @method _converse.ChatRoom#onHiddenChange
     */
    function onHiddenChange(): Promise<void>;
    function onOccupantAdded(occupant: any): void;
    function onOccupantRemoved(occupant: any): void;
    function onOccupantShowChanged(occupant: any): void;
    function onRoomEntered(): Promise<void>;
    function onConnectionStatusChanged(): Promise<void>;
    function onReconnection(): Promise<void>;
    function getMessagesCollection(): any;
    function restoreSession(): Promise<any>;
    function initDiscoModels(): void;
    function initOccupants(): void;
    function fetchOccupants(): any;
    function handleAffiliationChangedMessage(stanza: any): void;
    function handleErrorMessageStanza(stanza: any): Promise<void>;
    /**
     * Handles incoming message stanzas from the service that hosts this MUC
     * @private
     * @method _converse.ChatRoom#handleMessageFromMUCHost
     * @param { Element } stanza
     */
    function handleMessageFromMUCHost(stanza: Element): void;
    /**
     * Handles XEP-0452 MUC Mention Notification messages
     * @private
     * @method _converse.ChatRoom#handleForwardedMentions
     * @param { Element } stanza
     */
    function handleForwardedMentions(stanza: Element): void;
    /**
     * Parses an incoming message stanza and queues it for processing.
     * @private
     * @method _converse.ChatRoom#handleMessageStanza
     * @param { Element } stanza
     */
    function handleMessageStanza(stanza: Element): Promise<any>;
    /**
     * Register presence and message handlers relevant to this groupchat
     * @private
     * @method _converse.ChatRoom#registerHandlers
     */
    function registerHandlers(): void;
    function removeHandlers(): {
        defaults(): {
            bookmarked: boolean;
            chat_state: any;
            has_activity: boolean;
            hidden: boolean;
            hidden_occupants: boolean;
            message_type: string;
            name: string;
            num_unread_general: number;
            num_unread: number;
            roomconfig: {};
            time_opened: any;
            time_sent: string;
            type: string;
        };
        initialize(): Promise<void>;
        isEntered(): boolean;
        /**
         * Checks whether we're still joined and if so, restores the MUC state from cache.
         * @private
         * @method _converse.ChatRoom#restoreFromCache
         * @returns { Boolean } Returns `true` if we're still joined, otherwise returns `false`.
         */
        restoreFromCache(): boolean;
        /**
         * Join the MUC
         * @private
         * @method _converse.ChatRoom#join
         * @param { String } nick - The user's nickname
         * @param { String } [password] - Optional password, if required by the groupchat.
         *  Will fall back to the `password` value stored in the room
         *  model (if available).
         */
        join(nick: string, password?: string): Promise<any>;
        /**
         * Clear stale cache and re-join a MUC we've been in before.
         * @private
         * @method _converse.ChatRoom#rejoin
         */
        rejoin(): Promise<any>;
        constructJoinPresence(password: any): Promise<any>;
        clearOccupantsCache(): void;
        /**
         * Given the passed in MUC message, send a XEP-0333 chat marker.
         * @param { _converse.MUCMessage } msg
         * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
         * @param { Boolean } force - Whether a marker should be sent for the
         *  message, even if it didn't include a `markable` element.
         */
        sendMarkerForMessage(msg: _converse.MUCMessage, type?: "received" | "displayed" | "acknowledged", force?: boolean): void;
        /**
         * Ensures that the user is subscribed to XEP-0437 Room Activity Indicators
         * if `muc_subscribe_to_rai` is set to `true`.
         * Only affiliated users can subscribe to RAI, but this method doesn't
         * check whether the current user is affiliated because it's intended to be
         * called after the MUC has been left and we don't have that information
         * anymore.
         * @private
         * @method _converse.ChatRoom#enableRAI
         */
        enableRAI(): void;
        /**
         * Handler that gets called when the 'hidden' flag is toggled.
         * @private
         * @method _converse.ChatRoom#onHiddenChange
         */
        onHiddenChange(): Promise<void>;
        onOccupantAdded(occupant: any): void;
        onOccupantRemoved(occupant: any): void;
        onOccupantShowChanged(occupant: any): void;
        onRoomEntered(): Promise<void>;
        onConnectionStatusChanged(): Promise<void>;
        onReconnection(): Promise<void>;
        getMessagesCollection(): any;
        restoreSession(): Promise<any>;
        initDiscoModels(): void;
        initOccupants(): void;
        fetchOccupants(): any;
        handleAffiliationChangedMessage(stanza: any): void;
        handleErrorMessageStanza(stanza: any): Promise<void>;
        /**
         * Handles incoming message stanzas from the service that hosts this MUC
         * @private
         * @method _converse.ChatRoom#handleMessageFromMUCHost
         * @param { Element } stanza
         */
        handleMessageFromMUCHost(stanza: Element): void;
        /**
         * Handles XEP-0452 MUC Mention Notification messages
         * @private
         * @method _converse.ChatRoom#handleForwardedMentions
         * @param { Element } stanza
         */
        handleForwardedMentions(stanza: Element): void;
        /**
         * Parses an incoming message stanza and queues it for processing.
         * @private
         * @method _converse.ChatRoom#handleMessageStanza
         * @param { Element } stanza
         */
        handleMessageStanza(stanza: Element): Promise<any>;
        /**
         * Register presence and message handlers relevant to this groupchat
         * @private
         * @method _converse.ChatRoom#registerHandlers
         */
        registerHandlers(): void;
        removeHandlers(): any;
        invitesAllowed(): any;
        getDisplayName(): any;
        /**
         * Sends a message stanza to the XMPP server and expects a reflection
         * or error message within a specific timeout period.
         * @private
         * @method _converse.ChatRoom#sendTimedMessage
         * @param { _converse.Message|Element } message
         * @returns { Promise<Element>|Promise<_converse.TimeoutError> } Returns a promise
         *  which resolves with the reflected message stanza or with an error stanza or {@link _converse.TimeoutError}.
         */
        sendTimedMessage(el: any): Promise<Element> | Promise<_converse.TimeoutError>;
        /**
         * Retract one of your messages in this groupchat
         * @private
         * @method _converse.ChatRoom#retractOwnMessage
         * @param { _converse.Message } message - The message which we're retracting.
         */
        retractOwnMessage(message: _converse.Message): Promise<void>;
        /**
         * Retract someone else's message in this groupchat.
         * @private
         * @method _converse.ChatRoom#retractOtherMessage
         * @param { _converse.Message } message - The message which we're retracting.
         * @param { string } [reason] - The reason for retracting the message.
         * @example
         *  const room = await api.rooms.get(jid);
         *  const message = room.messages.findWhere({'body': 'Get rich quick!'});
         *  room.retractOtherMessage(message, 'spam');
         */
        retractOtherMessage(message: _converse.Message, reason?: string): Promise<any>;
        /**
         * Sends an IQ stanza to the XMPP server to retract a message in this groupchat.
         * @private
         * @method _converse.ChatRoom#sendRetractionIQ
         * @param { _converse.Message } message - The message which we're retracting.
         * @param { string } [reason] - The reason for retracting the message.
         */
        sendRetractionIQ(message: _converse.Message, reason?: string): Promise<any>;
        /**
         * Sends an IQ stanza to the XMPP server to destroy this groupchat. Not
         * to be confused with the {@link _converse.ChatRoom#destroy}
         * method, which simply removes the room from the local browser storage cache.
         * @private
         * @method _converse.ChatRoom#sendDestroyIQ
         * @param { string } [reason] - The reason for destroying the groupchat.
         * @param { string } [new_jid] - The JID of the new groupchat which replaces this one.
         */
        sendDestroyIQ(reason?: string, new_jid?: string): Promise<any>;
        /**
         * Leave the groupchat.
         * @private
         * @method _converse.ChatRoom#leave
         * @param { string } [exit_msg] - Message to indicate your reason for leaving
         */
        leave(exit_msg?: string): Promise<void>;
        close(ev: any): Promise<any>;
        canModerateMessages(): any;
        /**
         * Return an array of unique nicknames based on all occupants and messages in this MUC.
         * @private
         * @method _converse.ChatRoom#getAllKnownNicknames
         * @returns { String[] }
         */
        getAllKnownNicknames(): string[];
        getAllKnownNicknamesRegex(): RegExp;
        getOccupantByJID(jid: any): any;
        getOccupantByNickname(nick: any): any;
        getReferenceURIFromNickname(nickname: any): string;
        /**
         * Given a text message, look for `@` mentions and turn them into
         * XEP-0372 references
         * @param { String } text
         */
        parseTextForReferences(text: string): any[];
        getOutgoingMessageAttributes(attrs: any): Promise<any>;
        /**
         * Utility method to construct the JID for the current user as occupant of the groupchat.
         * @private
         * @method _converse.ChatRoom#getRoomJIDAndNick
         * @returns {string} - The groupchat JID with the user's nickname added at the end.
         * @example groupchat@conference.example.org/nickname
         */
        getRoomJIDAndNick(): string;
        /**
         * Sends a message with the current XEP-0085 chat state of the user
         * as taken from the `chat_state` attribute of the {@link _converse.ChatRoom}.
         * @private
         * @method _converse.ChatRoom#sendChatState
         */
        sendChatState(): void;
        /**
         * Send a direct invitation as per XEP-0249
         * @private
         * @method _converse.ChatRoom#directInvite
         * @param { String } recipient - JID of the person being invited
         * @param { String } [reason] - Reason for the invitation
         */
        directInvite(recipient: string, reason?: string): void;
        /**
         * Refresh the disco identity, features and fields for this {@link _converse.ChatRoom}.
         * *features* are stored on the features {@link Model} attribute on this {@link _converse.ChatRoom}.
         * *fields* are stored on the config {@link Model} attribute on this {@link _converse.ChatRoom}.
         * @private
         * @returns {Promise}
         */
        refreshDiscoInfo(): Promise<any>;
        /**
         * Fetch the *extended* MUC info from the server and cache it locally
         * https://xmpp.org/extensions/xep-0045.html#disco-roominfo
         * @private
         * @method _converse.ChatRoom#getDiscoInfo
         * @returns {Promise}
         */
        getDiscoInfo(): Promise<any>;
        /**
         * Fetch the *extended* MUC info fields from the server and store them locally
         * in the `config` {@link Model} attribute.
         * See: https://xmpp.org/extensions/xep-0045.html#disco-roominfo
         * @private
         * @method _converse.ChatRoom#getDiscoInfoFields
         * @returns {Promise}
         */
        getDiscoInfoFields(): Promise<any>;
        /**
         * Use converse-disco to populate the features {@link Model} which
         * is stored as an attibute on this {@link _converse.ChatRoom}.
         * The results may be cached. If you want to force fetching the features from the
         * server, call {@link _converse.ChatRoom#refreshDiscoInfo} instead.
         * @private
         * @returns {Promise}
         */
        getDiscoInfoFeatures(): Promise<any>;
        /**
         * Given a <field> element, return a copy with a <value> child if
         * we can find a value for it in this rooms config.
         * @private
         * @method _converse.ChatRoom#addFieldValue
         * @returns { Element }
         */
        addFieldValue(field: any): Element;
        /**
         * Automatically configure the groupchat based on this model's
         * 'roomconfig' data.
         * @private
         * @method _converse.ChatRoom#autoConfigureChatRoom
         * @returns { Promise<Element> }
         * Returns a promise which resolves once a response IQ has
         * been received.
         */
        autoConfigureChatRoom(): Promise<Element>;
        /**
         * Send an IQ stanza to fetch the groupchat configuration data.
         * Returns a promise which resolves once the response IQ
         * has been received.
         * @private
         * @method _converse.ChatRoom#fetchRoomConfiguration
         * @returns { Promise<Element> }
         */
        fetchRoomConfiguration(): Promise<Element>;
        /**
         * Sends an IQ stanza with the groupchat configuration.
         * @private
         * @method _converse.ChatRoom#sendConfiguration
         * @param { Array } config - The groupchat configuration
         * @returns { Promise<Element> } - A promise which resolves with
         * the `result` stanza received from the XMPP server.
         */
        sendConfiguration(config?: any[]): Promise<Element>;
        onCommandError(err: any): void;
        getNickOrJIDFromCommandArgs(args: any): any;
        validateRoleOrAffiliationChangeArgs(command: any, args: any): boolean;
        getAllowedCommands(): string[];
        verifyAffiliations(affiliations: any, occupant: any, show_error?: boolean): boolean;
        verifyRoles(roles: any, occupant: any, show_error?: boolean): boolean;
        /**
         * Returns the `role` which the current user has in this MUC
         * @private
         * @method _converse.ChatRoom#getOwnRole
         * @returns { ('none'|'visitor'|'participant'|'moderator') }
         */
        getOwnRole(): "none" | "moderator" | "participant" | "visitor";
        /**
         * Returns the `affiliation` which the current user has in this MUC
         * @private
         * @method _converse.ChatRoom#getOwnAffiliation
         * @returns { ('none'|'outcast'|'member'|'admin'|'owner') }
         */
        getOwnAffiliation(): "none" | "admin" | "owner" | "member" | "outcast";
        /**
         * Get the {@link _converse.ChatRoomOccupant} instance which
         * represents the current user.
         * @method _converse.ChatRoom#getOwnOccupant
         * @returns { _converse.ChatRoomOccupant }
         */
        getOwnOccupant(): _converse.ChatRoomOccupant;
        /**
         * Send a presence stanza to update the user's nickname in this MUC.
         * @param { String } nick
         */
        setNickname(nick: string): Promise<void>;
        /**
         * Send an IQ stanza to modify an occupant's role
         * @private
         * @method _converse.ChatRoom#setRole
         * @param { _converse.ChatRoomOccupant } occupant
         * @param { String } role
         * @param { String } reason
         * @param { function } onSuccess - callback for a succesful response
         * @param { function } onError - callback for an error response
         */
        setRole(occupant: _converse.ChatRoomOccupant, role: string, reason: string, onSuccess: Function, onError: Function): Promise<any>;
        /**
         * @private
         * @method _converse.ChatRoom#getOccupant
         * @param { String } nickname_or_jid - The nickname or JID of the occupant to be returned
         * @returns { _converse.ChatRoomOccupant }
         */
        getOccupant(nickname_or_jid: string): _converse.ChatRoomOccupant;
        /**
         * Return an array of occupant models that have the required role
         * @private
         * @method _converse.ChatRoom#getOccupantsWithRole
         * @param { String } role
         * @returns { _converse.ChatRoomOccupant[] }
         */
        getOccupantsWithRole(role: string): _converse.ChatRoomOccupant[];
        /**
         * Return an array of occupant models that have the required affiliation
         * @private
         * @method _converse.ChatRoom#getOccupantsWithAffiliation
         * @param { String } affiliation
         * @returns { _converse.ChatRoomOccupant[] }
         */
        getOccupantsWithAffiliation(affiliation: string): _converse.ChatRoomOccupant[];
        /**
         * Return an array of occupant models, sorted according to the passed-in attribute.
         * @private
         * @method _converse.ChatRoom#getOccupantsSortedBy
         * @param { String } attr - The attribute to sort the returned array by
         * @returns { _converse.ChatRoomOccupant[] }
         */
        getOccupantsSortedBy(attr: string): _converse.ChatRoomOccupant[];
        /**
         * Fetch the lists of users with the given affiliations.
         * Then compute the delta between those users and
         * the passed in members, and if it exists, send the delta
         * to the XMPP server to update the member list.
         * @private
         * @method _converse.ChatRoom#updateMemberLists
         * @param { object } members - Map of member jids and affiliations.
         * @returns { Promise }
         *  A promise which is resolved once the list has been
         *  updated or once it's been established there's no need
         *  to update the list.
         */
        updateMemberLists(members: any): Promise<any>;
        /**
         * Given a nick name, save it to the model state, otherwise, look
         * for a server-side reserved nickname or default configured
         * nickname and if found, persist that to the model state.
         * @private
         * @method _converse.ChatRoom#getAndPersistNickname
         * @returns { Promise<string> } A promise which resolves with the nickname
         */
        getAndPersistNickname(nick: any): Promise<string>;
        /**
         * Use service-discovery to ask the XMPP server whether
         * this user has a reserved nickname for this groupchat.
         * If so, we'll use that, otherwise we render the nickname form.
         * @private
         * @method _converse.ChatRoom#getReservedNick
         * @returns { Promise<string> } A promise which resolves with the reserved nick or null
         */
        getReservedNick(): Promise<string>;
        /**
         * Send an IQ stanza to the MUC to register this user's nickname.
         * This sets the user's affiliation to 'member' (if they weren't affiliated
         * before) and reserves the nickname for this user, thereby preventing other
         * users from using it in this MUC.
         * See https://xmpp.org/extensions/xep-0045.html#register
         * @private
         * @method _converse.ChatRoom#registerNickname
         */
        registerNickname(): Promise<any>;
        /**
         * Check whether we should unregister the user from this MUC, and if so,
         * call { @link _converse.ChatRoom#sendUnregistrationIQ }
         * @method _converse.ChatRoom#unregisterNickname
         */
        unregisterNickname(): Promise<void>;
        /**
         * Send an IQ stanza to the MUC to unregister this user's nickname.
         * If the user had a 'member' affiliation, it'll be removed and their
         * nickname will no longer be reserved and can instead be used (and
         * registered) by other users.
         * @method _converse.ChatRoom#sendUnregistrationIQ
         */
        sendUnregistrationIQ(): Promise<any>;
        /**
         * Given a presence stanza, update the occupant model based on its contents.
         * @private
         * @method _converse.ChatRoom#updateOccupantsOnPresence
         * @param { Element } pres - The presence stanza
         */
        updateOccupantsOnPresence(pres: Element): boolean;
        fetchFeaturesIfConfigurationChanged(stanza: any): void;
        /**
         * Given two JIDs, which can be either user JIDs or MUC occupant JIDs,
         * determine whether they belong to the same user.
         * @private
         * @method _converse.ChatRoom#isSameUser
         * @param { String } jid1
         * @param { String } jid2
         * @returns { Boolean }
         */
        isSameUser(jid1: string, jid2: string): boolean;
        isSubjectHidden(): Promise<any>;
        toggleSubjectHiddenState(): Promise<void>;
        /**
         * Handle a possible subject change and return `true` if so.
         * @private
         * @method _converse.ChatRoom#handleSubjectChange
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         */
        handleSubjectChange(attrs: any): Promise<boolean>;
        /**
         * Set the subject for this {@link _converse.ChatRoom}
         * @private
         * @method _converse.ChatRoom#setSubject
         * @param { String } value
         */
        setSubject(value?: string): void;
        /**
         * Is this a chat state notification that can be ignored,
         * because it's old or because it's from us.
         * @private
         * @method _converse.ChatRoom#ignorableCSN
         * @param { Object } attrs - The message attributes
         */
        ignorableCSN(attrs: any): any;
        /**
         * Determines whether the message is from ourselves by checking
         * the `from` attribute. Doesn't check the `type` attribute.
         * @private
         * @method _converse.ChatRoom#isOwnMessage
         * @param { Object|Element|_converse.Message } msg
         * @returns { boolean }
         */
        isOwnMessage(msg: any): boolean;
        getUpdatedMessageAttributes(message: any, attrs: any): any;
        /**
         * Send a MUC-0410 MUC Self-Ping stanza to room to determine
         * whether we're still joined.
         * @async
         * @private
         * @method _converse.ChatRoom#isJoined
         * @returns {Promise<boolean>}
         */
        isJoined(): Promise<boolean>;
        /**
         * Sends a status update presence (i.e. based on the `<show>` element)
         * @method _converse.ChatRoom#sendStatusPresence
         * @param { String } type
         * @param { String } [status] - An optional status message
         * @param { Element[]|Strophe.Builder[]|Element|Strophe.Builder } [child_nodes]
         *  Nodes(s) to be added as child nodes of the `presence` XML element.
         */
        sendStatusPresence(type: string, status?: string, child_nodes?: any): Promise<void>;
        /**
         * Check whether we're still joined and re-join if not
         * @async
         * @method _converse.ChatRoom#rejoinIfNecessary
         */
        rejoinIfNecessary(): Promise<boolean>;
        /**
         * @private
         * @method _converse.ChatRoom#shouldShowErrorMessage
         * @returns {Promise<boolean>}
         */
        shouldShowErrorMessage(attrs: any): Promise<boolean>;
        /**
         * Looks whether we already have a moderation message for this
         * incoming message. If so, it's considered "dangling" because
         * it probably hasn't been applied to anything yet, given that
         * the relevant message is only coming in now.
         * @private
         * @method _converse.ChatRoom#findDanglingModeration
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         * @returns { _converse.ChatRoomMessage }
         */
        findDanglingModeration(attrs: any): _converse.ChatRoomMessage;
        /**
         * Handles message moderation based on the passed in attributes.
         * @private
         * @method _converse.ChatRoom#handleModeration
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         * @returns { Boolean } Returns `true` or `false` depending on
         *  whether a message was moderated or not.
         */
        handleModeration(attrs: any): boolean;
        getNotificationsText(): any;
        /**
         * @param {String} actor - The nickname of the actor that caused the notification
         * @param {String|Array<String>} states - The state or states representing the type of notificcation
         */
        removeNotification(actor: string, states: string | string[]): void;
        /**
         * Update the notifications model by adding the passed in nickname
         * to the array of nicknames that all match a particular state.
         *
         * Removes the nickname from any other states it might be associated with.
         *
         * The state can be a XEP-0085 Chat State or a XEP-0045 join/leave
         * state.
         * @param {String} actor - The nickname of the actor that causes the notification
         * @param {String} state - The state representing the type of notificcation
         */
        updateNotifications(actor: string, state: string): void;
        handleMetadataFastening(attrs: any): boolean;
        /**
         * Given {@link MessageAttributes} look for XEP-0316 Room Notifications and create info
         * messages for them.
         * @param { Element } stanza
         */
        handleMEPNotification(attrs: any): boolean;
        /**
         * Returns an already cached message (if it exists) based on the
         * passed in attributes map.
         * @method _converse.ChatRoom#getDuplicateMessage
         * @param { object } attrs - Attributes representing a received
         *  message, as returned by {@link parseMUCMessage}
         * @returns {Promise<_converse.Message>}
         */
        getDuplicateMessage(attrs: any): Promise<_converse.Message>;
        /**
         * Handler for all MUC messages sent to this groupchat. This method
         * shouldn't be called directly, instead {@link _converse.ChatRoom#queueMessage}
         * should be called.
         * @method _converse.ChatRoom#onMessage
         * @param { MessageAttributes } attrs - A promise which resolves to the message attributes.
         */
        onMessage(attrs: MessageAttributes): Promise<void>;
        handleModifyError(pres: any): void;
        /**
         * Handle a presence stanza that disconnects the user from the MUC
         * @param { Element } stanza
         */
        handleDisconnection(stanza: Element): void;
        getActionInfoMessage(code: any, nick: any, actor: any): any;
        createAffiliationChangeMessage(occupant: any): void;
        createRoleChangeMessage(occupant: any, changed: any): void;
        /**
         * Create an info message based on a received MUC status code
         * @private
         * @method _converse.ChatRoom#createInfoMessage
         * @param { string } code - The MUC status code
         * @param { Element } stanza - The original stanza that contains the code
         * @param { Boolean } is_self - Whether this stanza refers to our own presence
         */
        createInfoMessage(code: string, stanza: Element, is_self: boolean): void;
        /**
         * Create info messages based on a received presence or message stanza
         * @private
         * @method _converse.ChatRoom#createInfoMessages
         * @param { Element } stanza
         */
        createInfoMessages(stanza: Element): void;
        /**
         * Set parameters regarding disconnection from this room. This helps to
         * communicate to the user why they were disconnected.
         * @param { String } message - The disconnection message, as received from (or
         *  implied by) the server.
         * @param { String } reason - The reason provided for the disconnection
         * @param { String } actor - The person (if any) responsible for this disconnection
         * @param { Integer } status - The status code (see `ROOMSTATUS`)
         */
        setDisconnectionState(message: string, reason: string, actor: string, status?: Integer): void;
        onNicknameClash(presence: any): void;
        /**
         * Parses a <presence> stanza with type "error" and sets the proper
         * `connection_status` value for this {@link _converse.ChatRoom} as
         * well as any additional output that can be shown to the user.
         * @private
         * @param { Element } stanza - The presence stanza
         */
        onErrorPresence(stanza: Element): void;
        /**
         * Listens for incoming presence stanzas from the service that hosts this MUC
         * @private
         * @method _converse.ChatRoom#onPresenceFromMUCHost
         * @param { Element } stanza - The presence stanza
         */
        onPresenceFromMUCHost(stanza: Element): void;
        /**
         * Handles incoming presence stanzas coming from the MUC
         * @private
         * @method _converse.ChatRoom#onPresence
         * @param { Element } stanza
         */
        onPresence(stanza: Element): void;
        /**
         * Handles a received presence relating to the current user.
         *
         * For locked groupchats (which are by definition "new"), the
         * groupchat will either be auto-configured or created instantly
         * (with default config) or a configuration groupchat will be
         * rendered.
         *
         * If the groupchat is not locked, then the groupchat will be
         * auto-configured only if applicable and if the current
         * user is the groupchat's owner.
         * @private
         * @method _converse.ChatRoom#onOwnPresence
         * @param { Element } pres - The stanza
         */
        onOwnPresence(stanza: any): Promise<void>;
        /**
         * Returns a boolean to indicate whether the current user
         * was mentioned in a message.
         * @private
         * @method _converse.ChatRoom#isUserMentioned
         * @param { String } - The text message
         */
        isUserMentioned(message: any): any;
        incrementUnreadMsgsCounter(message: any): void;
        clearUnreadMsgCounter(): void;
    };
    function invitesAllowed(): any;
    function getDisplayName(): any;
    /**
     * Sends a message stanza to the XMPP server and expects a reflection
     * or error message within a specific timeout period.
     * @private
     * @method _converse.ChatRoom#sendTimedMessage
     * @param { _converse.Message|Element } message
     * @returns { Promise<Element>|Promise<_converse.TimeoutError> } Returns a promise
     *  which resolves with the reflected message stanza or with an error stanza or {@link _converse.TimeoutError}.
     */
    function sendTimedMessage(el: any): Promise<Element> | Promise<_converse.TimeoutError>;
    /**
     * Retract one of your messages in this groupchat
     * @private
     * @method _converse.ChatRoom#retractOwnMessage
     * @param { _converse.Message } message - The message which we're retracting.
     */
    function retractOwnMessage(message: _converse.Message): Promise<void>;
    /**
     * Retract someone else's message in this groupchat.
     * @private
     * @method _converse.ChatRoom#retractOtherMessage
     * @param { _converse.Message } message - The message which we're retracting.
     * @param { string } [reason] - The reason for retracting the message.
     * @example
     *  const room = await api.rooms.get(jid);
     *  const message = room.messages.findWhere({'body': 'Get rich quick!'});
     *  room.retractOtherMessage(message, 'spam');
     */
    function retractOtherMessage(message: _converse.Message, reason?: string): Promise<any>;
    /**
     * Sends an IQ stanza to the XMPP server to retract a message in this groupchat.
     * @private
     * @method _converse.ChatRoom#sendRetractionIQ
     * @param { _converse.Message } message - The message which we're retracting.
     * @param { string } [reason] - The reason for retracting the message.
     */
    function sendRetractionIQ(message: _converse.Message, reason?: string): Promise<any>;
    /**
     * Sends an IQ stanza to the XMPP server to destroy this groupchat. Not
     * to be confused with the {@link _converse.ChatRoom#destroy}
     * method, which simply removes the room from the local browser storage cache.
     * @private
     * @method _converse.ChatRoom#sendDestroyIQ
     * @param { string } [reason] - The reason for destroying the groupchat.
     * @param { string } [new_jid] - The JID of the new groupchat which replaces this one.
     */
    function sendDestroyIQ(reason?: string, new_jid?: string): Promise<any>;
    /**
     * Leave the groupchat.
     * @private
     * @method _converse.ChatRoom#leave
     * @param { string } [exit_msg] - Message to indicate your reason for leaving
     */
    function leave(exit_msg?: string): Promise<void>;
    function close(ev: any): Promise<any>;
    function canModerateMessages(): any;
    /**
     * Return an array of unique nicknames based on all occupants and messages in this MUC.
     * @private
     * @method _converse.ChatRoom#getAllKnownNicknames
     * @returns { String[] }
     */
    function getAllKnownNicknames(): string[];
    function getAllKnownNicknamesRegex(): RegExp;
    function getOccupantByJID(jid: any): any;
    function getOccupantByNickname(nick: any): any;
    function getReferenceURIFromNickname(nickname: any): string;
    /**
     * Given a text message, look for `@` mentions and turn them into
     * XEP-0372 references
     * @param { String } text
     */
    function parseTextForReferences(text: string): any[];
    function getOutgoingMessageAttributes(attrs: any): Promise<any>;
    /**
     * Utility method to construct the JID for the current user as occupant of the groupchat.
     * @private
     * @method _converse.ChatRoom#getRoomJIDAndNick
     * @returns {string} - The groupchat JID with the user's nickname added at the end.
     * @example groupchat@conference.example.org/nickname
     */
    function getRoomJIDAndNick(): string;
    /**
     * Sends a message with the current XEP-0085 chat state of the user
     * as taken from the `chat_state` attribute of the {@link _converse.ChatRoom}.
     * @private
     * @method _converse.ChatRoom#sendChatState
     */
    function sendChatState(): void;
    /**
     * Send a direct invitation as per XEP-0249
     * @private
     * @method _converse.ChatRoom#directInvite
     * @param { String } recipient - JID of the person being invited
     * @param { String } [reason] - Reason for the invitation
     */
    function directInvite(recipient: string, reason?: string): void;
    /**
     * Refresh the disco identity, features and fields for this {@link _converse.ChatRoom}.
     * *features* are stored on the features {@link Model} attribute on this {@link _converse.ChatRoom}.
     * *fields* are stored on the config {@link Model} attribute on this {@link _converse.ChatRoom}.
     * @private
     * @returns {Promise}
     */
    function refreshDiscoInfo(): Promise<any>;
    /**
     * Fetch the *extended* MUC info from the server and cache it locally
     * https://xmpp.org/extensions/xep-0045.html#disco-roominfo
     * @private
     * @method _converse.ChatRoom#getDiscoInfo
     * @returns {Promise}
     */
    function getDiscoInfo(): Promise<any>;
    /**
     * Fetch the *extended* MUC info fields from the server and store them locally
     * in the `config` {@link Model} attribute.
     * See: https://xmpp.org/extensions/xep-0045.html#disco-roominfo
     * @private
     * @method _converse.ChatRoom#getDiscoInfoFields
     * @returns {Promise}
     */
    function getDiscoInfoFields(): Promise<any>;
    /**
     * Use converse-disco to populate the features {@link Model} which
     * is stored as an attibute on this {@link _converse.ChatRoom}.
     * The results may be cached. If you want to force fetching the features from the
     * server, call {@link _converse.ChatRoom#refreshDiscoInfo} instead.
     * @private
     * @returns {Promise}
     */
    function getDiscoInfoFeatures(): Promise<any>;
    /**
     * Given a <field> element, return a copy with a <value> child if
     * we can find a value for it in this rooms config.
     * @private
     * @method _converse.ChatRoom#addFieldValue
     * @returns { Element }
     */
    function addFieldValue(field: any): Element;
    /**
     * Automatically configure the groupchat based on this model's
     * 'roomconfig' data.
     * @private
     * @method _converse.ChatRoom#autoConfigureChatRoom
     * @returns { Promise<Element> }
     * Returns a promise which resolves once a response IQ has
     * been received.
     */
    function autoConfigureChatRoom(): Promise<Element>;
    /**
     * Send an IQ stanza to fetch the groupchat configuration data.
     * Returns a promise which resolves once the response IQ
     * has been received.
     * @private
     * @method _converse.ChatRoom#fetchRoomConfiguration
     * @returns { Promise<Element> }
     */
    function fetchRoomConfiguration(): Promise<Element>;
    /**
     * Sends an IQ stanza with the groupchat configuration.
     * @private
     * @method _converse.ChatRoom#sendConfiguration
     * @param { Array } config - The groupchat configuration
     * @returns { Promise<Element> } - A promise which resolves with
     * the `result` stanza received from the XMPP server.
     */
    function sendConfiguration(config?: any[]): Promise<Element>;
    function onCommandError(err: any): void;
    function getNickOrJIDFromCommandArgs(args: any): any;
    function validateRoleOrAffiliationChangeArgs(command: any, args: any): boolean;
    function getAllowedCommands(): string[];
    function verifyAffiliations(affiliations: any, occupant: any, show_error?: boolean): boolean;
    function verifyRoles(roles: any, occupant: any, show_error?: boolean): boolean;
    /**
     * Returns the `role` which the current user has in this MUC
     * @private
     * @method _converse.ChatRoom#getOwnRole
     * @returns { ('none'|'visitor'|'participant'|'moderator') }
     */
    function getOwnRole(): "none" | "moderator" | "participant" | "visitor";
    /**
     * Returns the `affiliation` which the current user has in this MUC
     * @private
     * @method _converse.ChatRoom#getOwnAffiliation
     * @returns { ('none'|'outcast'|'member'|'admin'|'owner') }
     */
    function getOwnAffiliation(): "none" | "admin" | "owner" | "member" | "outcast";
    /**
     * Get the {@link _converse.ChatRoomOccupant} instance which
     * represents the current user.
     * @method _converse.ChatRoom#getOwnOccupant
     * @returns { _converse.ChatRoomOccupant }
     */
    function getOwnOccupant(): _converse.ChatRoomOccupant;
    /**
     * Send a presence stanza to update the user's nickname in this MUC.
     * @param { String } nick
     */
    function setNickname(nick: string): Promise<void>;
    /**
     * Send an IQ stanza to modify an occupant's role
     * @private
     * @method _converse.ChatRoom#setRole
     * @param { _converse.ChatRoomOccupant } occupant
     * @param { String } role
     * @param { String } reason
     * @param { function } onSuccess - callback for a succesful response
     * @param { function } onError - callback for an error response
     */
    function setRole(occupant: _converse.ChatRoomOccupant, role: string, reason: string, onSuccess: Function, onError: Function): Promise<any>;
    /**
     * @private
     * @method _converse.ChatRoom#getOccupant
     * @param { String } nickname_or_jid - The nickname or JID of the occupant to be returned
     * @returns { _converse.ChatRoomOccupant }
     */
    function getOccupant(nickname_or_jid: string): _converse.ChatRoomOccupant;
    /**
     * Return an array of occupant models that have the required role
     * @private
     * @method _converse.ChatRoom#getOccupantsWithRole
     * @param { String } role
     * @returns { _converse.ChatRoomOccupant[] }
     */
    function getOccupantsWithRole(role: string): _converse.ChatRoomOccupant[];
    /**
     * Return an array of occupant models that have the required affiliation
     * @private
     * @method _converse.ChatRoom#getOccupantsWithAffiliation
     * @param { String } affiliation
     * @returns { _converse.ChatRoomOccupant[] }
     */
    function getOccupantsWithAffiliation(affiliation: string): _converse.ChatRoomOccupant[];
    /**
     * Return an array of occupant models, sorted according to the passed-in attribute.
     * @private
     * @method _converse.ChatRoom#getOccupantsSortedBy
     * @param { String } attr - The attribute to sort the returned array by
     * @returns { _converse.ChatRoomOccupant[] }
     */
    function getOccupantsSortedBy(attr: string): _converse.ChatRoomOccupant[];
    /**
     * Fetch the lists of users with the given affiliations.
     * Then compute the delta between those users and
     * the passed in members, and if it exists, send the delta
     * to the XMPP server to update the member list.
     * @private
     * @method _converse.ChatRoom#updateMemberLists
     * @param { object } members - Map of member jids and affiliations.
     * @returns { Promise }
     *  A promise which is resolved once the list has been
     *  updated or once it's been established there's no need
     *  to update the list.
     */
    function updateMemberLists(members: any): Promise<any>;
    /**
     * Given a nick name, save it to the model state, otherwise, look
     * for a server-side reserved nickname or default configured
     * nickname and if found, persist that to the model state.
     * @private
     * @method _converse.ChatRoom#getAndPersistNickname
     * @returns { Promise<string> } A promise which resolves with the nickname
     */
    function getAndPersistNickname(nick: any): Promise<string>;
    /**
     * Use service-discovery to ask the XMPP server whether
     * this user has a reserved nickname for this groupchat.
     * If so, we'll use that, otherwise we render the nickname form.
     * @private
     * @method _converse.ChatRoom#getReservedNick
     * @returns { Promise<string> } A promise which resolves with the reserved nick or null
     */
    function getReservedNick(): Promise<string>;
    /**
     * Send an IQ stanza to the MUC to register this user's nickname.
     * This sets the user's affiliation to 'member' (if they weren't affiliated
     * before) and reserves the nickname for this user, thereby preventing other
     * users from using it in this MUC.
     * See https://xmpp.org/extensions/xep-0045.html#register
     * @private
     * @method _converse.ChatRoom#registerNickname
     */
    function registerNickname(): Promise<any>;
    /**
     * Check whether we should unregister the user from this MUC, and if so,
     * call { @link _converse.ChatRoom#sendUnregistrationIQ }
     * @method _converse.ChatRoom#unregisterNickname
     */
    function unregisterNickname(): Promise<void>;
    /**
     * Send an IQ stanza to the MUC to unregister this user's nickname.
     * If the user had a 'member' affiliation, it'll be removed and their
     * nickname will no longer be reserved and can instead be used (and
     * registered) by other users.
     * @method _converse.ChatRoom#sendUnregistrationIQ
     */
    function sendUnregistrationIQ(): Promise<any>;
    /**
     * Given a presence stanza, update the occupant model based on its contents.
     * @private
     * @method _converse.ChatRoom#updateOccupantsOnPresence
     * @param { Element } pres - The presence stanza
     */
    function updateOccupantsOnPresence(pres: Element): boolean;
    function fetchFeaturesIfConfigurationChanged(stanza: any): void;
    /**
     * Given two JIDs, which can be either user JIDs or MUC occupant JIDs,
     * determine whether they belong to the same user.
     * @private
     * @method _converse.ChatRoom#isSameUser
     * @param { String } jid1
     * @param { String } jid2
     * @returns { Boolean }
     */
    function isSameUser(jid1: string, jid2: string): boolean;
    function isSubjectHidden(): Promise<any>;
    function toggleSubjectHiddenState(): Promise<void>;
    /**
     * Handle a possible subject change and return `true` if so.
     * @private
     * @method _converse.ChatRoom#handleSubjectChange
     * @param { object } attrs - Attributes representing a received
     *  message, as returned by {@link parseMUCMessage}
     */
    function handleSubjectChange(attrs: any): Promise<boolean>;
    /**
     * Set the subject for this {@link _converse.ChatRoom}
     * @private
     * @method _converse.ChatRoom#setSubject
     * @param { String } value
     */
    function setSubject(value?: string): void;
    /**
     * Is this a chat state notification that can be ignored,
     * because it's old or because it's from us.
     * @private
     * @method _converse.ChatRoom#ignorableCSN
     * @param { Object } attrs - The message attributes
     */
    function ignorableCSN(attrs: any): any;
    /**
     * Determines whether the message is from ourselves by checking
     * the `from` attribute. Doesn't check the `type` attribute.
     * @private
     * @method _converse.ChatRoom#isOwnMessage
     * @param { Object|Element|_converse.Message } msg
     * @returns { boolean }
     */
    function isOwnMessage(msg: any): boolean;
    function getUpdatedMessageAttributes(message: any, attrs: any): any;
    /**
     * Send a MUC-0410 MUC Self-Ping stanza to room to determine
     * whether we're still joined.
     * @async
     * @private
     * @method _converse.ChatRoom#isJoined
     * @returns {Promise<boolean>}
     */
    function isJoined(): Promise<boolean>;
    /**
     * Sends a status update presence (i.e. based on the `<show>` element)
     * @method _converse.ChatRoom#sendStatusPresence
     * @param { String } type
     * @param { String } [status] - An optional status message
     * @param { Element[]|Strophe.Builder[]|Element|Strophe.Builder } [child_nodes]
     *  Nodes(s) to be added as child nodes of the `presence` XML element.
     */
    function sendStatusPresence(type: string, status?: string, child_nodes?: any): Promise<void>;
    /**
     * Check whether we're still joined and re-join if not
     * @async
     * @method _converse.ChatRoom#rejoinIfNecessary
     */
    function rejoinIfNecessary(): Promise<boolean>;
    /**
     * @private
     * @method _converse.ChatRoom#shouldShowErrorMessage
     * @returns {Promise<boolean>}
     */
    function shouldShowErrorMessage(attrs: any): Promise<boolean>;
    /**
     * Looks whether we already have a moderation message for this
     * incoming message. If so, it's considered "dangling" because
     * it probably hasn't been applied to anything yet, given that
     * the relevant message is only coming in now.
     * @private
     * @method _converse.ChatRoom#findDanglingModeration
     * @param { object } attrs - Attributes representing a received
     *  message, as returned by {@link parseMUCMessage}
     * @returns { _converse.ChatRoomMessage }
     */
    function findDanglingModeration(attrs: any): _converse.ChatRoomMessage;
    /**
     * Handles message moderation based on the passed in attributes.
     * @private
     * @method _converse.ChatRoom#handleModeration
     * @param { object } attrs - Attributes representing a received
     *  message, as returned by {@link parseMUCMessage}
     * @returns { Boolean } Returns `true` or `false` depending on
     *  whether a message was moderated or not.
     */
    function handleModeration(attrs: any): boolean;
    function getNotificationsText(): any;
    /**
     * @param {String} actor - The nickname of the actor that caused the notification
     * @param {String|Array<String>} states - The state or states representing the type of notificcation
     */
    function removeNotification(actor: string, states: string | string[]): void;
    /**
     * Update the notifications model by adding the passed in nickname
     * to the array of nicknames that all match a particular state.
     *
     * Removes the nickname from any other states it might be associated with.
     *
     * The state can be a XEP-0085 Chat State or a XEP-0045 join/leave
     * state.
     * @param {String} actor - The nickname of the actor that causes the notification
     * @param {String} state - The state representing the type of notificcation
     */
    function updateNotifications(actor: string, state: string): void;
    function handleMetadataFastening(attrs: any): boolean;
    /**
     * Given {@link MessageAttributes} look for XEP-0316 Room Notifications and create info
     * messages for them.
     * @param { Element } stanza
     */
    function handleMEPNotification(attrs: any): boolean;
    /**
     * Returns an already cached message (if it exists) based on the
     * passed in attributes map.
     * @method _converse.ChatRoom#getDuplicateMessage
     * @param { object } attrs - Attributes representing a received
     *  message, as returned by {@link parseMUCMessage}
     * @returns {Promise<_converse.Message>}
     */
    function getDuplicateMessage(attrs: any): Promise<_converse.Message>;
    /**
     * Handler for all MUC messages sent to this groupchat. This method
     * shouldn't be called directly, instead {@link _converse.ChatRoom#queueMessage}
     * should be called.
     * @method _converse.ChatRoom#onMessage
     * @param { MessageAttributes } attrs - A promise which resolves to the message attributes.
     */
    function onMessage(attrs: MessageAttributes): Promise<void>;
    function handleModifyError(pres: any): void;
    /**
     * Handle a presence stanza that disconnects the user from the MUC
     * @param { Element } stanza
     */
    function handleDisconnection(stanza: Element): void;
    function getActionInfoMessage(code: any, nick: any, actor: any): any;
    function createAffiliationChangeMessage(occupant: any): void;
    function createRoleChangeMessage(occupant: any, changed: any): void;
    /**
     * Create an info message based on a received MUC status code
     * @private
     * @method _converse.ChatRoom#createInfoMessage
     * @param { string } code - The MUC status code
     * @param { Element } stanza - The original stanza that contains the code
     * @param { Boolean } is_self - Whether this stanza refers to our own presence
     */
    function createInfoMessage(code: string, stanza: Element, is_self: boolean): void;
    /**
     * Create info messages based on a received presence or message stanza
     * @private
     * @method _converse.ChatRoom#createInfoMessages
     * @param { Element } stanza
     */
    function createInfoMessages(stanza: Element): void;
    /**
     * Set parameters regarding disconnection from this room. This helps to
     * communicate to the user why they were disconnected.
     * @param { String } message - The disconnection message, as received from (or
     *  implied by) the server.
     * @param { String } reason - The reason provided for the disconnection
     * @param { String } actor - The person (if any) responsible for this disconnection
     * @param { Integer } status - The status code (see `ROOMSTATUS`)
     */
    function setDisconnectionState(message: string, reason: string, actor: string, status?: Integer): void;
    function onNicknameClash(presence: any): void;
    /**
     * Parses a <presence> stanza with type "error" and sets the proper
     * `connection_status` value for this {@link _converse.ChatRoom} as
     * well as any additional output that can be shown to the user.
     * @private
     * @param { Element } stanza - The presence stanza
     */
    function onErrorPresence(stanza: Element): void;
    /**
     * Listens for incoming presence stanzas from the service that hosts this MUC
     * @private
     * @method _converse.ChatRoom#onPresenceFromMUCHost
     * @param { Element } stanza - The presence stanza
     */
    function onPresenceFromMUCHost(stanza: Element): void;
    /**
     * Handles incoming presence stanzas coming from the MUC
     * @private
     * @method _converse.ChatRoom#onPresence
     * @param { Element } stanza
     */
    function onPresence(stanza: Element): void;
    /**
     * Handles a received presence relating to the current user.
     *
     * For locked groupchats (which are by definition "new"), the
     * groupchat will either be auto-configured or created instantly
     * (with default config) or a configuration groupchat will be
     * rendered.
     *
     * If the groupchat is not locked, then the groupchat will be
     * auto-configured only if applicable and if the current
     * user is the groupchat's owner.
     * @private
     * @method _converse.ChatRoom#onOwnPresence
     * @param { Element } pres - The stanza
     */
    function onOwnPresence(stanza: any): Promise<void>;
    /**
     * Returns a boolean to indicate whether the current user
     * was mentioned in a message.
     * @private
     * @method _converse.ChatRoom#isUserMentioned
     * @param { String } - The text message
     */
    function isUserMentioned(message: any): any;
    function incrementUnreadMsgsCounter(message: any): void;
    function clearUnreadMsgCounter(): void;
}
