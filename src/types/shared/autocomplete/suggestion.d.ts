export default Suggestion;
/**
 * An autocomplete suggestion
 */
declare class Suggestion extends String {
    /**
     * @param {import("./types").AutoCompleteData} data
     * @param {string} query - The query string being auto-completed
     */
    constructor(data: import("./types").AutoCompleteData, query: string);
    label: any;
    value: any;
    query: string;
    data: import("./types").AutoCompleteData;
    get length(): any;
}
//# sourceMappingURL=suggestion.d.ts.map