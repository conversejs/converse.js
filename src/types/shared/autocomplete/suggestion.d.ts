export default Suggestion;
/**
 * An autocomplete suggestion
 */
declare class Suggestion extends String {
    /**
     * @param {any} data - The auto-complete data. Ideally an object e.g. { label, value },
     *      which specifies the value and human-presentable label of the suggestion.
     * @param {string} query - The query string being auto-completed
     */
    constructor(data: any, query: string);
    label: any;
    value: any;
    query: string;
    data: any;
    get lenth(): any;
}
//# sourceMappingURL=suggestion.d.ts.map