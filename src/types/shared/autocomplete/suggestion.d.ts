export default Suggestion;
/**
 * An autocomplete suggestion
 * @template [T=object]
 */
declare class Suggestion<T = any> extends String {
    /**
     * @param {import("./types").AutoCompleteData<T>} data
     * @param {string} query - The query string being auto-completed
     */
    constructor(data: import("./types").AutoCompleteData<T>, query: string);
    label: any;
    value: any;
    query: string;
    data: import("./types").AutoCompleteData<T>;
    get length(): any;
}
//# sourceMappingURL=suggestion.d.ts.map