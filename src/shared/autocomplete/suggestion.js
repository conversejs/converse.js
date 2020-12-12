/**
 * An autocomplete suggestion
 */
class Suggestion extends String {
    /**
     * @param { Any } data - The auto-complete data. Ideally an object e.g. { label, value },
     *      which specifies the value and human-presentable label of the suggestion.
     * @param { string } query - The query string being auto-completed
     */
    constructor (data, query) {
        super();
        const o = Array.isArray(data)
            ? { label: data[0], value: data[1] }
            : typeof data === 'object' && 'label' in data && 'value' in data
            ? data
            : { label: data, value: data };

        this.label = o.label || o.value;
        this.value = o.value;
        this.query = query;
    }

    get lenth () {
        return this.label.length;
    }

    toString () {
        return '' + this.label;
    }

    valueOf () {
        return this.toString();
    }
}

export default Suggestion;
