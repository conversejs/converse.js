export default class MUCView {
    length: number;
    is_chatroom: boolean;
    initialize(): Promise<void>;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    onConnectionStatusChanged(): void;
}
