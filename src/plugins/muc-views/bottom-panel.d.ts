export default class MUCBottomPanel {
    events: {
        'click .hide-occupants': string;
        'click .send-button': string;
    };
    initialize(): Promise<void>;
    render(): void;
    renderIfOwnOccupant(o: any): void;
    sendButtonClicked(ev: any): void;
    hideOccupants(ev: any): void;
}
