export default class RosterContact {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    initialize(): void;
    render(): import("lit-html").TemplateResult<1>;
    openChat(ev: any): void;
    removeContact(ev: any): Promise<void>;
    acceptRequest(ev: any): Promise<void>;
    declineRequest(ev: any): Promise<RosterContact>;
}
