export class RosterFilterView {
    initialize(): Promise<void>;
    model: any;
    liveFilter: any;
    render(): "" | import("lit-html").TemplateResult<1>;
    dispatchUpdateEvent(): void;
    changeChatStateFilter(ev: any): void;
    changeTypeFilter(ev: any): void;
    submitFilter(ev: any): void;
    /**
     * Returns true if the filter is enabled (i.e. if the user
     * has added values to the filter).
     * @private
     * @method _converse.RosterFilterView#isActive
     */
    private isActive;
    shouldBeVisible(): any;
    clearFilter(ev: any): void;
}
