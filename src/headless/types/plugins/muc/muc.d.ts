export default MUC;
declare const MUC_base: {
    new (...args: any[]): {
        disable_mam: boolean;
        initialize(): Promise<void>;
        initNotifications(): void;
        notifications: Model;
        initUI(): void;
        ui: Model;
        getDisplayName(): string;
        canPostMessages(): boolean;
        createMessage(attrs: any, options: any): Promise<any>;
        getMessagesCacheKey(): string;
        getMessagesCollection(): any;
        getNotificationsText(): any;
        initMessages(): void;
        messages: any;
        fetchMessages(): any;
        afterMessagesFetched(): void;
        onMessage(_promise: Promise<import("../chat/parsers").MessageAttributes>): Promise<void>;
        getUpdatedMessageAttributes(message: import("../chat/message.js").default, attrs: import("../chat/parsers").MessageAttributes): object;
        updateMessage(message: import("../chat/message.js").default, attrs: import("../chat/parsers").MessageAttributes): void;
        handleCorrection(attrs: import("../chat/parsers").MessageAttributes | import("./parsers.js").MUCMessageAttributes): Promise<import("../chat/message.js").default | void>;
        queueMessage(attrs: Promise<import("../chat/parsers").MessageAttributes>): any;
        msg_chain: any;
        getOutgoingMessageAttributes(_attrs?: import("../chat/parsers").MessageAttributes): Promise<import("../chat/parsers").MessageAttributes>;
        sendMessage(attrs?: any): Promise<import("../chat/message.js").default>;
        retractOwnMessage(message: import("../chat/message.js").default): void;
        sendFiles(files: File[]): Promise<void>;
        setEditable(attrs: any, send_time: string): void;
        setChatState(state: string, options?: object): any;
        chat_state_timeout: NodeJS.Timeout;
        onMessageAdded(message: import("../chat/message.js").default): void;
        onMessageUploadChanged(message: import("../chat/message.js").default): Promise<void>;
        onScrolledChanged(): void;
        pruneHistoryWhenScrolledDown(): void;
        shouldShowErrorMessage(attrs: import("../chat/parsers").MessageAttributes): Promise<boolean>;
        clearMessages(): Promise<void>;
        editEarlierMessage(): void;
        editLaterMessage(): any;
        getOldestMessage(): any;
        getMostRecentMessage(): any;
        getMessageReferencedByError(attrs: object): any;
        findDanglingRetraction(attrs: object): import("../chat/message.js").default | null;
        getDuplicateMessage(attrs: object): import("../chat/message.js").default;
        getOriginIdQueryAttrs(attrs: object): {
            origin_id: any;
            from: any;
        };
        getStanzaIdQueryAttrs(attrs: object): {}[];
        getMessageBodyQueryAttrs(attrs: object): {
            from: any;
            msgid: any;
        };
        sendMarkerForMessage(msg: import("../chat/message.js").default, type?: ("received" | "displayed" | "acknowledged"), force?: boolean): void;
        handleUnreadMessage(message: import("../chat/message.js").default): void;
        handleErrorMessageStanza(stanza: Element): Promise<void>;
        incrementUnreadMsgsCounter(message: import("../chat/message.js").default): void;
        clearUnreadMsgCounter(): void;
        handleRetraction(attrs: import("../chat/parsers").MessageAttributes): Promise<boolean>;
        handleReceipt(attrs: import("../chat/parsers").MessageAttributes): boolean;
        createMessageStanza(message: import("../chat/message.js").default): Promise<any>;
        pruneHistory(): void;
        debouncedPruneHistory: import("lodash").DebouncedFunc<() => void>;
        isScrolledUp(): any;
        isHidden(): boolean;
        cid: any;
        attributes: {};
        validationError: string;
        collection: any;
        changed: {};
        browserStorage: Storage;
        _browserStorage: Storage;
        readonly idAttribute: string;
        readonly cidPrefix: string;
        preinitialize(): void;
        validate(attrs: object, options?: object): string;
        toJSON(): any;
        sync(method: "create" | "update" | "patch" | "delete" | "read", model: Model, options: import("@converse/skeletor/src/types/model").Options): any;
        get(attr: string): any;
        keys(): string[];
        values(): any[];
        pairs(): [string, any][];
        entries(): [string, any][];
        invert(): any;
        pick(...args: any[]): any;
        omit(...args: any[]): any;
        isEmpty(): any;
        has(attr: string): boolean;
        matches(attrs: import("@converse/skeletor/src/types/model").Attributes): boolean;
        set(key: string | any, val?: string | any, options?: import("@converse/skeletor/src/types/model").Options): false | any;
        _changing: boolean;
        _previousAttributes: any;
        id: any;
        _pending: boolean | import("@converse/skeletor/src/types/model").Options;
        unset(attr: string, options?: import("@converse/skeletor/src/types/model").Options): false | any;
        clear(options: import("@converse/skeletor/src/types/model").Options): false | any;
        hasChanged(attr?: string): any;
        changedAttributes(diff: any): any;
        previous(attr?: string): any;
        previousAttributes(): any;
        fetch(options?: import("@converse/skeletor/src/types/model").Options): any;
        save(key?: string | import("@converse/skeletor/src/types/model").Attributes, val?: boolean | number | string | import("@converse/skeletor/src/types/model").Options, options?: import("@converse/skeletor/src/types/model").Options): any;
        destroy(options?: import("@converse/skeletor/src/types/model").Options): boolean;
        url(): any;
        parse(resp: import("@converse/skeletor/src/types/model").Options, options?: import("@converse/skeletor/src/types/model").Options): import("@converse/skeletor/src/types/model").Options;
        isNew(): boolean;
        isValid(options?: import("@converse/skeletor/src/types/model").Options): boolean;
        _validate(attrs: import("@converse/skeletor/src/types/model").Attributes, options?: import("@converse/skeletor/src/types/model").Options): boolean;
        on(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        _events: any;
        _listeners: {};
        listenTo(obj: any, name: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        _listeningTo: {};
        _listenId: any;
        off(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context?: any): any;
        stopListening(obj?: any, name?: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        once(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        listenToOnce(obj: any, name: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        trigger(name: string, ...args: any[]): any;
        constructor: Function;
        toString(): string;
        toLocaleString(): string;
        valueOf(): Object;
        hasOwnProperty(v: PropertyKey): boolean;
        isPrototypeOf(v: Object): boolean;
        propertyIsEnumerable(v: PropertyKey): boolean;
    };
} & {
    new (...args: any[]): {
        setColor(): Promise<void>;
        getIdentifier(): any;
        getColor(): Promise<string>;
        getAvatarStyle(append_style?: string): Promise<string>;
        cid: any;
        attributes: {};
        validationError: string;
        collection: any;
        changed: {};
        browserStorage: Storage;
        _browserStorage: Storage;
        readonly idAttribute: string;
        readonly cidPrefix: string;
        preinitialize(): void;
        initialize(): void;
        validate(attrs: object, options?: object): string;
        toJSON(): any;
        sync(method: "create" | "update" | "patch" | "delete" | "read", model: Model, options: import("@converse/skeletor/src/types/model").Options): any;
        get(attr: string): any;
        keys(): string[];
        values(): any[];
        pairs(): [string, any][];
        entries(): [string, any][];
        invert(): any;
        pick(...args: any[]): any;
        omit(...args: any[]): any;
        isEmpty(): any;
        has(attr: string): boolean;
        matches(attrs: import("@converse/skeletor/src/types/model").Attributes): boolean;
        set(key: string | any, val?: string | any, options?: import("@converse/skeletor/src/types/model").Options): false | any;
        _changing: boolean;
        _previousAttributes: any;
        id: any;
        _pending: boolean | import("@converse/skeletor/src/types/model").Options;
        unset(attr: string, options?: import("@converse/skeletor/src/types/model").Options): false | any;
        clear(options: import("@converse/skeletor/src/types/model").Options): false | any;
        hasChanged(attr?: string): any;
        changedAttributes(diff: any): any;
        previous(attr?: string): any;
        previousAttributes(): any;
        fetch(options?: import("@converse/skeletor/src/types/model").Options): any;
        save(key?: string | import("@converse/skeletor/src/types/model").Attributes, val?: boolean | number | string | import("@converse/skeletor/src/types/model").Options, options?: import("@converse/skeletor/src/types/model").Options): any;
        destroy(options?: import("@converse/skeletor/src/types/model").Options): boolean;
        url(): any;
        parse(resp: import("@converse/skeletor/src/types/model").Options, options?: import("@converse/skeletor/src/types/model").Options): import("@converse/skeletor/src/types/model").Options;
        isNew(): boolean;
        isValid(options?: import("@converse/skeletor/src/types/model").Options): boolean;
        _validate(attrs: import("@converse/skeletor/src/types/model").Attributes, options?: import("@converse/skeletor/src/types/model").Options): boolean;
        on(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        _events: any;
        _listeners: {};
        listenTo(obj: any, name: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        _listeningTo: {};
        _listenId: any;
        off(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context?: any): any;
        stopListening(obj?: any, name?: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        once(name: string, callback: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any, context: any): any;
        listenToOnce(obj: any, name: string, callback?: (event: any, model: Model, collection: import("@converse/skeletor").Collection, options: Record<string, any>) => any): any;
        trigger(name: string, ...args: any[]): any;
        constructor: Function;
        toString(): string;
        toLocaleString(): string;
        valueOf(): Object;
        hasOwnProperty(v: PropertyKey): boolean;
        isPrototypeOf(v: Object): boolean;
        propertyIsEnumerable(v: PropertyKey): boolean;
    };
} & typeof ChatBoxBase;
/**
 * Represents a groupchat conversation.
 */
declare class MUC extends MUC_base {
    /**
     * @typedef {import('../vcard/vcard').default} VCard
     * @typedef {import('../chat/message.js').default} Message
     * @typedef {import('./message.js').default} MUCMessage
     * @typedef {import('./occupant.js').default} MUCOccupant
     * @typedef {import('./affiliations/utils.js').NonOutcastAffiliation} NonOutcastAffiliation
     * @typedef {import('./parsers').MemberListItem} MemberListItem
     * @typedef {module:plugin-chat-parsers.MessageAttributes} MessageAttributes
     * @typedef {import('./parsers').MUCMessageAttributes} MUCMessageAttributes
     * @typedef {module:shared.converse.UserMessage} UserMessage
     * @typedef {import('strophe.js').Builder} Builder
     * @typedef {import('../../shared/parsers').StanzaParseError} StanzaParseError
     */
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
    /**
     * @public
     * @type {VCard}
     */
    public vcard: import("../vcard/vcard").default;
    initialized: any;
    debouncedRejoin: import("lodash").DebouncedFunc<() => Promise<this>>;
    isEntered(): boolean;
    /**
     * Checks whether this MUC qualifies for subscribing to XEP-0437 Room Activity Indicators (RAI)
     * @returns {Boolean}
     */
    isRAICandidate(): boolean;
    /**
     * Checks whether we're still joined and if so, restores the MUC state from cache.
     * @returns {Promise<boolean>} Returns `true` if we're still joined, otherwise returns `false`.
     */
    restoreFromCache(): Promise<boolean>;
    /**
     * Join the MUC
     * @param {String} [nick] - The user's nickname
     * @param {String} [password] - Optional password, if required by the groupchat.
     *  Will fall back to the `password` value stored in the room
     *  model (if available).
     */
    join(nick?: string, password?: string): Promise<this>;
    /**
     * Clear stale cache and re-join a MUC we've been in before.
     */
    rejoin(): Promise<this>;
    /**
     * @param {string} password
     */
    constructJoinPresence(password: string): Promise<import("strophe.js").Builder>;
    clearOccupantsCache(): void;
    /**
     * Given the passed in MUC message, send a XEP-0333 chat marker.
     * @param {MUCMessage} msg
     * @param {('received'|'displayed'|'acknowledged')} [type='displayed']
     * @param {Boolean} force - Whether a marker should be sent for the
     *  message, even if it didn't include a `markable` element.
     */
    sendMarkerForMessage(msg: import("./message.js").default, type?: ("received" | "displayed" | "acknowledged"), force?: boolean): void;
    /**
     * Finds the last eligible message and then sends a XEP-0333 chat marker for it.
     * @param { ('received'|'displayed'|'acknowledged') } [type='displayed']
     * @param {Boolean} force - Whether a marker should be sent for the
     *  message, even if it didn't include a `markable` element.
     */
    sendMarkerForLastMessage(type?: ("received" | "displayed" | "acknowledged"), force?: boolean): void;
    /**
     * Ensures that the user is subscribed to XEP-0437 Room Activity Indicators
     * if `muc_subscribe_to_rai` is set to `true`.
     * Only affiliated users can subscribe to RAI, but this method doesn't
     * check whether the current user is affiliated because it's intended to be
     * called after the MUC has been left and we don't have that information anymore.
     */
    enableRAI(): void;
    /**
     * Handler that gets called when the 'hidden' flag is toggled.
     */
    onHiddenChange(): Promise<void>;
    /**
     * @param {MUCOccupant} occupant
     */
    onOccupantAdded(occupant: import("./occupant.js").default): void;
    /**
     * @param {MUCOccupant} occupant
     */
    onOccupantRemoved(occupant: import("./occupant.js").default): void;
    /**
     * @param {MUCOccupant} occupant
     */
    onOccupantShowChanged(occupant: import("./occupant.js").default): void;
    onRoomEntered(): Promise<void>;
    onConnectionStatusChanged(): Promise<void>;
    getMessagesCollection(): any;
    restoreSession(): Promise<any>;
    session: MUCSession;
    initDiscoModels(): void;
    features: Model;
    config: Model;
    initOccupants(): void;
    occupants: any;
    fetchOccupants(): any;
    /**
     * @param {Element} stanza
     */
    handleAffiliationChangedMessage(stanza: Element): void;
    /**
     * @param {Element} stanza
     */
    handleErrorMessageStanza(stanza: Element): Promise<void>;
    /**
     * Handles incoming message stanzas from the service that hosts this MUC
     * @param {Element} stanza
     */
    handleMessageFromMUCHost(stanza: Element): void;
    /**
     * Handles XEP-0452 MUC Mention Notification messages
     * @param {Element} stanza
     */
    handleForwardedMentions(stanza: Element): void;
    /**
     * Parses an incoming message stanza and queues it for processing.
     * @param {Builder|Element} stanza
     */
    handleMessageStanza(stanza: import("strophe.js").Builder | Element): Promise<any>;
    /**
     * Register presence and message handlers relevant to this groupchat
     */
    registerHandlers(): void;
    presence_handler: any;
    domain_presence_handler: any;
    message_handler: any;
    domain_message_handler: any;
    affiliation_message_handler: any;
    removeHandlers(): this;
    invitesAllowed(): any;
    getDisplayName(): any;
    /**
     * Sends a message stanza to the XMPP server and expects a reflection
     * or error message within a specific timeout period.
     * @param {Builder|Element } message
     * @returns { Promise<Element>|Promise<TimeoutError> } Returns a promise
     *  which resolves with the reflected message stanza or with an error stanza or
     *  {@link TimeoutError}.
     */
    sendTimedMessage(message: import("strophe.js").Builder | Element): Promise<Element> | Promise<TimeoutError>;
    /**
     * Retract one of your messages in this groupchat
     * @param {MUCMessage} message - The message which we're retracting.
     */
    retractOwnMessage(message: import("./message.js").default): Promise<void>;
    /**
     * Retract someone else's message in this groupchat.
     * @param {MUCMessage} message - The message which we're retracting.
     * @param {string} [reason] - The reason for retracting the message.
     * @example
     *  const room = await api.rooms.get(jid);
     *  const message = room.messages.findWhere({'body': 'Get rich quick!'});
     *  room.retractOtherMessage(message, 'spam');
     */
    retractOtherMessage(message: import("./message.js").default, reason?: string): Promise<any>;
    /**
     * Sends an IQ stanza to the XMPP server to retract a message in this groupchat.
     * @param {MUCMessage} message - The message which we're retracting.
     * @param {string} [reason] - The reason for retracting the message.
     */
    sendRetractionIQ(message: import("./message.js").default, reason?: string): any;
    /**
     * Sends an IQ stanza to the XMPP server to destroy this groupchat. Not
     * to be confused with the {@link MUC#destroy}
     * method, which simply removes the room from the local browser storage cache.
     * @param {string} [reason] - The reason for destroying the groupchat.
     * @param {string} [new_jid] - The JID of the new groupchat which replaces this one.
     */
    sendDestroyIQ(reason?: string, new_jid?: string): any;
    /**
     * Leave the groupchat.
     * @param { string } [exit_msg] - Message to indicate your reason for leaving
     */
    leave(exit_msg?: string): Promise<void>;
    /**
     * @typedef {Object} CloseEvent
     * @property {string} name
     * @param {CloseEvent} [ev]
     */
    close(ev?: {
        name: string;
    }): Promise<void>;
    canModerateMessages(): any;
    canPostMessages(): boolean;
    /**
     * Return an array of unique nicknames based on all occupants and messages in this MUC.
     * @returns {String[]}
     */
    getAllKnownNicknames(): string[];
    getAllKnownNicknamesRegex(): RegExp;
    /**
     * @param {string} jid
     */
    getOccupantByJID(jid: string): any;
    /**
     * @param {string} nick
     */
    getOccupantByNickname(nick: string): any;
    /**
     * @param {string} nick
     */
    getReferenceURIFromNickname(nick: string): string;
    /**
     * Given a text message, look for `@` mentions and turn them into
     * XEP-0372 references
     * @param { String } text
     */
    parseTextForReferences(text: string): any[];
    /**
     * @param {MessageAttributes} [attrs] - A map of attributes to be saved on the message
     */
    getOutgoingMessageAttributes(attrs?: any): Promise<any>;
    /**
     * Utility method to construct the JID for the current user as occupant of the groupchat.
     * @returns {string} - The groupchat JID with the user's nickname added at the end.
     * @example groupchat@conference.example.org/nickname
     */
    getRoomJIDAndNick(): string;
    /**
     * Sends a message with the current XEP-0085 chat state of the user
     * as taken from the `chat_state` attribute of the {@link MUC}.
     */
    sendChatState(): void;
    /**
     * Send a direct invitation as per XEP-0249
     * @param {String} recipient - JID of the person being invited
     * @param {String} [reason] - Reason for the invitation
     */
    directInvite(recipient: string, reason?: string): void;
    /**
     * Refresh the disco identity, features and fields for this {@link MUC}.
     * *features* are stored on the features {@link Model} attribute on this {@link MUC}.
     * *fields* are stored on the config {@link Model} attribute on this {@link MUC}.
     * @returns {Promise}
     */
    refreshDiscoInfo(): Promise<any>;
    /**
     * Fetch the *extended* MUC info from the server and cache it locally
     * https://xmpp.org/extensions/xep-0045.html#disco-roominfo
     * @returns {Promise}
     */
    getDiscoInfo(): Promise<any>;
    /**
     * Fetch the *extended* MUC info fields from the server and store them locally
     * in the `config` {@link Model} attribute.
     * See: https://xmpp.org/extensions/xep-0045.html#disco-roominfo
     * @returns {Promise}
     */
    getDiscoInfoFields(): Promise<any>;
    /**
     * Use converse-disco to populate the features {@link Model} which
     * is stored as an attibute on this {@link MUC}.
     * The results may be cached. If you want to force fetching the features from the
     * server, call {@link MUC#refreshDiscoInfo} instead.
     * @returns {Promise}
     */
    getDiscoInfoFeatures(): Promise<any>;
    /**
     * Given a <field> element, return a copy with a <value> child if
     * we can find a value for it in this rooms config.
     * @param {Element} field
     * @returns {Element}
     */
    addFieldValue(field: Element): Element;
    /**
     * Automatically configure the groupchat based on this model's
     * 'roomconfig' data.
     * @returns {Promise<Element>}
     * Returns a promise which resolves once a response IQ has
     * been received.
     */
    autoConfigureChatRoom(): Promise<Element>;
    /**
     * Send an IQ stanza to fetch the groupchat configuration data.
     * Returns a promise which resolves once the response IQ
     * has been received.
     * @returns {Promise<Element>}
     */
    fetchRoomConfiguration(): Promise<Element>;
    /**
     * Sends an IQ stanza with the groupchat configuration.
     * @param {Array} config - The groupchat configuration
     * @returns {Promise<Element>} - A promise which resolves with
     *  the `result` stanza received from the XMPP server.
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
     * @returns {('none'|'visitor'|'participant'|'moderator')}
     */
    getOwnRole(): ("none" | "visitor" | "participant" | "moderator");
    /**
     * Returns the `affiliation` which the current user has in this MUC
     * @returns {('none'|'outcast'|'member'|'admin'|'owner')}
     */
    getOwnAffiliation(): ("none" | "outcast" | "member" | "admin" | "owner");
    /**
     * Get the {@link MUCOccupant} instance which
     * represents the current user.
     * @returns {MUCOccupant}
     */
    getOwnOccupant(): import("./occupant.js").default;
    /**
     * Send a presence stanza to update the user's nickname in this MUC.
     * @param { String } nick
     */
    setNickname(nick: string): Promise<void>;
    /**
     * Send an IQ stanza to modify an occupant's role
     * @param {MUCOccupant} occupant
     * @param {string} role
     * @param {string} reason
     * @param {function} onSuccess - callback for a succesful response
     * @param {function} onError - callback for an error response
     */
    setRole(occupant: import("./occupant.js").default, role: string, reason: string, onSuccess: Function, onError: Function): any;
    /**
     * @param {string} nickname_or_jid - The nickname or JID of the occupant to be returned
     * @returns {MUCOccupant}
     */
    getOccupant(nickname_or_jid: string): import("./occupant.js").default;
    /**
     * Return an array of occupant models that have the required role
     * @param {string} role
     * @returns {{jid: string, nick: string, role: string}[]}
     */
    getOccupantsWithRole(role: string): {
        jid: string;
        nick: string;
        role: string;
    }[];
    /**
     * Return an array of occupant models that have the required affiliation
     * @param {string} affiliation
     * @returns {{jid: string, nick: string, affiliation: string}[]}
     */
    getOccupantsWithAffiliation(affiliation: string): {
        jid: string;
        nick: string;
        affiliation: string;
    }[];
    /**
     * Return an array of occupant models, sorted according to the passed-in attribute.
     * @param {string} attr - The attribute to sort the returned array by
     * @returns {MUCOccupant[]}
     */
    getOccupantsSortedBy(attr: string): import("./occupant.js").default[];
    /**
     * Fetch the lists of users with the given affiliations.
     * Then compute the delta between those users and
     * the passed in members, and if it exists, send the delta
     * to the XMPP server to update the member list.
     * @param {object} members - Map of member jids and affiliations.
     * @returns {Promise}
     *  A promise which is resolved once the list has been
     *  updated or once it's been established there's no need
     *  to update the list.
     */
    updateMemberLists(members: object): Promise<any>;
    /**
     * Given a nick name, save it to the model state, otherwise, look
     * for a server-side reserved nickname or default configured
     * nickname and if found, persist that to the model state.
     * @param {string} nick
     * @returns {Promise<string>} A promise which resolves with the nickname
     */
    getAndPersistNickname(nick: string): Promise<string>;
    /**
     * Use service-discovery to ask the XMPP server whether
     * this user has a reserved nickname for this groupchat.
     * If so, we'll use that, otherwise we render the nickname form.
     * @returns {Promise<string>} A promise which resolves with the reserved nick or null
     */
    getReservedNick(): Promise<string>;
    /**
     * Send an IQ stanza to the MUC to register this user's nickname.
     * This sets the user's affiliation to 'member' (if they weren't affiliated
     * before) and reserves the nickname for this user, thereby preventing other
     * users from using it in this MUC.
     * See https://xmpp.org/extensions/xep-0045.html#register
     */
    registerNickname(): Promise<any>;
    /**
     * Check whether we should unregister the user from this MUC, and if so,
     * call {@link MUC#sendUnregistrationIQ}
     */
    unregisterNickname(): Promise<void>;
    /**
     * Send an IQ stanza to the MUC to unregister this user's nickname.
     * If the user had a 'member' affiliation, it'll be removed and their
     * nickname will no longer be reserved and can instead be used (and
     * registered) by other users.
     */
    sendUnregistrationIQ(): any;
    /**
     * Given a presence stanza, update the occupant model based on its contents.
     * @param {Element} pres - The presence stanza
     */
    updateOccupantsOnPresence(pres: Element): boolean;
    fetchFeaturesIfConfigurationChanged(stanza: any): void;
    /**
     * Given two JIDs, which can be either user JIDs or MUC occupant JIDs,
     * determine whether they belong to the same user.
     * @param {String} jid1
     * @param {String} jid2
     * @returns {Boolean}
     */
    isSameUser(jid1: string, jid2: string): boolean;
    isSubjectHidden(): Promise<any>;
    toggleSubjectHiddenState(): Promise<void>;
    /**
     * Handle a possible subject change and return `true` if so.
     * @param {object} attrs - Attributes representing a received
     *  message, as returned by {@link parseMUCMessage}
     */
    handleSubjectChange(attrs: object): Promise<boolean>;
    /**
     * Set the subject for this {@link MUC}
     * @param {String} value
     */
    setSubject(value?: string): void;
    /**
     * Is this a chat state notification that can be ignored,
     * because it's old or because it's from us.
     * @param {Object} attrs - The message attributes
     */
    ignorableCSN(attrs: any): any;
    /**
     * Determines whether the message is from ourselves by checking
     * the `from` attribute. Doesn't check the `type` attribute.
     * @param {Object|Element|MUCMessage} msg
     * @returns {boolean}
     */
    isOwnMessage(msg: any | Element | import("./message.js").default): boolean;
    /**
     * @param {MUCMessage} message
     * @param {MUCMessageAttributes} attrs
     * @return {object}
     */
    getUpdatedMessageAttributes(message: import("./message.js").default, attrs: import("./parsers.js").MUCMessageAttributes): object;
    /**
     * Send a MUC-0410 MUC Self-Ping stanza to room to determine
     * whether we're still joined.
     * @returns {Promise<boolean>}
     */
    isJoined(): Promise<boolean>;
    /**
     * Sends a status update presence (i.e. based on the `<show>` element)
     * @param {String} type
     * @param {String} [status] - An optional status message
     * @param {Element[]|Builder[]|Element|Builder} [child_nodes]
     *  Nodes(s) to be added as child nodes of the `presence` XML element.
     */
    sendStatusPresence(type: string, status?: string, child_nodes?: Element[] | import("strophe.js").Builder[] | Element | import("strophe.js").Builder): Promise<void>;
    /**
     * Check whether we're still joined and re-join if not
     */
    rejoinIfNecessary(): Promise<boolean>;
    /**
     * @param {object} attrs
     * @returns {Promise<boolean>}
     */
    shouldShowErrorMessage(attrs: object): Promise<boolean>;
    /**
     * Looks whether we already have a moderation message for this
     * incoming message. If so, it's considered "dangling" because
     * it probably hasn't been applied to anything yet, given that
     * the relevant message is only coming in now.
     * @param {object} attrs - Attributes representing a received
     *  message, as returned by {@link parseMUCMessage}
     * @returns {MUCMessage}
     */
    findDanglingModeration(attrs: object): import("./message.js").default;
    /**
     * Handles message moderation based on the passed in attributes.
     * @param {object} attrs - Attributes representing a received
     *  message, as returned by {@link parseMUCMessage}
     * @returns {Promise<boolean>} Returns `true` or `false` depending on
     *  whether a message was moderated or not.
     */
    handleModeration(attrs: object): Promise<boolean>;
    getNotificationsText(): any;
    /**
     * @param { String } actor - The nickname of the actor that caused the notification
     * @param {String|Array<String>} states - The state or states representing the type of notificcation
     */
    removeNotification(actor: string, states: string | Array<string>): void;
    /**
     * Update the notifications model by adding the passed in nickname
     * to the array of nicknames that all match a particular state.
     *
     * Removes the nickname from any other states it might be associated with.
     *
     * The state can be a XEP-0085 Chat State or a XEP-0045 join/leave state.
     * @param {String} actor - The nickname of the actor that causes the notification
     * @param {String} state - The state representing the type of notificcation
     */
    updateNotifications(actor: string, state: string): void;
    /**
     * @param {MessageAttributes} attrs
     * @returns {boolean}
     */
    handleMUCPrivateMessage(attrs: any): boolean;
    /**
     * @param {MessageAttributes} attrs
     * @returns {boolean}
     */
    handleMetadataFastening(attrs: any): boolean;
    /**
     * Given {@link MessageAttributes} look for XEP-0316 Room Notifications and create info
     * messages for them.
     * @param {MessageAttributes} attrs
     * @returns {boolean}
     */
    handleMEPNotification(attrs: any): boolean;
    /**
     * Returns an already cached message (if it exists) based on the
     * passed in attributes map.
     * @param {object} attrs - Attributes representing a received
     *  message, as returned by {@link parseMUCMessage}
     * @returns {Message}
     */
    getDuplicateMessage(attrs: object): import("../chat/message.js").default;
    /**
     * Handler for all MUC messages sent to this groupchat. This method
     * shouldn't be called directly, instead {@link MUC#queueMessage}
     * should be called.
     * @param {Promise<MessageAttributes>} promise - A promise which resolves to the message attributes.
     */
    onMessage(promise: Promise<any>): Promise<void>;
    /**
     * @param {Element} pres
     */
    handleModifyError(pres: Element): void;
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
     * @param {string} code - The MUC status code
     * @param {Element} stanza - The original stanza that contains the code
     * @param {Boolean} is_self - Whether this stanza refers to our own presence
     */
    createInfoMessage(code: string, stanza: Element, is_self: boolean): void;
    /**
     * Create info messages based on a received presence or message stanza
     * @param {Element} stanza
     */
    createInfoMessages(stanza: Element): void;
    /**
     * Set parameters regarding disconnection from this room. This helps to
     * communicate to the user why they were disconnected.
     * @param {string} message - The disconnection message, as received from (or
     *  implied by) the server.
     * @param {string} [reason] - The reason provided for the disconnection
     * @param {string} [actor] - The person (if any) responsible for this disconnection
     * @param {number} [status] - The status code (see `ROOMSTATUS`)
     */
    setDisconnectionState(message: string, reason?: string, actor?: string, status?: number): void;
    /**
     * @param {Element} presence
     */
    onNicknameClash(presence: Element): void;
    /**
     * Parses a <presence> stanza with type "error" and sets the proper
     * `connection_status` value for this {@link MUC} as
     * well as any additional output that can be shown to the user.
     * @param { Element } stanza - The presence stanza
     */
    onErrorPresence(stanza: Element): void;
    /**
     * Listens for incoming presence stanzas from the service that hosts this MUC
     * @param {Element} stanza - The presence stanza
     */
    onPresenceFromMUCHost(stanza: Element): void;
    /**
     * Handles incoming presence stanzas coming from the MUC
     * @param {Element} stanza
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
     * @param {Element} stanza - The stanza
     */
    onOwnPresence(stanza: Element): Promise<void>;
    /**
     * Returns a boolean to indicate whether the current user
     * was mentioned in a message.
     * @param {MUCMessage} message - The text message
     */
    isUserMentioned(message: import("./message.js").default): any;
    /**
     * @param {MUCMessage} message - The text message
     */
    incrementUnreadMsgsCounter(message: import("./message.js").default): void;
    clearUnreadMsgCounter(): void;
}
import { Model } from '@converse/skeletor';
import ChatBoxBase from '../../shared/chatbox';
import MUCSession from './session';
import { TimeoutError } from '../../shared/errors.js';
//# sourceMappingURL=muc.d.ts.map