export default class MUCMessageForm {
    connectedCallback(): Promise<void>;
    toHTML(): import("lit-html").TemplateResult<1>;
    afterRender(): void;
    initMentionAutoComplete(): void;
    mention_auto_complete: any;
    auto_completing: boolean;
    getAutoCompleteList(): any;
    onKeyDown(ev: any): void;
    onKeyUp(ev: any): void;
}
