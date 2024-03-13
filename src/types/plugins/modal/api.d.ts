export default modal_api;
declare namespace modal_api {
    namespace modal {
        /**
         * Shows a modal of type `ModalClass` to the user.
         * Will create a new instance of that class if an existing one isn't
         * found.
         * @param {string|any} name
         * @param {Object} [properties] - Optional properties that will be set on a newly created modal instance.
         * @param {Event} [ev] - The DOM event that causes the modal to be shown.
         */
        function show(name: any, properties?: any, ev?: Event): any;
        /**
         * Return a modal with the passed-in identifier, if it exists.
         * @param { String } id
         */
        function get(id: string): any;
        /**
         * Create a modal of the passed-in type.
         * @param {String} name
         * @param {Object} [properties] - Optional properties that will be
         *  set on the modal instance.
         */
        function create(name: string, properties?: any): HTMLElement;
        /**
         * Remove a particular modal
         * @param { String } name
         */
        function remove(name: string): void;
        /**
         * Remove all modals
         */
        function removeAll(): void;
    }
    /**
     * @typedef Field
     * @property { String } Field.label - The form label for the input field.
     * @property { String } Field.name - The name for the input field.
     * @property { String } [Field.challenge] - A challenge value that must be provided by the user.
     * @property { String } [Field.placeholder] - The placeholder for the input field.
     * @property { Boolean} [Field.required] - Whether the field is required or not
     */
    /**
     * Show a confirm modal to the user.
     * @method _converse.api.confirm
     * @param { String } title - The header text for the confirmation dialog
     * @param { (Array<String>|String) } messages - The text to show to the user
     * @param { Array<Field> } fields - An object representing a fields presented to the user.
     * @returns { Promise<Array|false> } A promise which resolves with an array of
     *  filled in fields or `false` if the confirm dialog was closed or canceled.
     */
    function confirm(title: string, messages?: string | string[], fields?: {
        /**
         * - The form label for the input field.
         */
        label: string;
        /**
         * - The name for the input field.
         */
        name: string;
        /**
         * - A challenge value that must be provided by the user.
         */
        challenge?: string;
        /**
         * - The placeholder for the input field.
         */
        placeholder?: string;
        /**
         * - Whether the field is required or not
         */
        required?: boolean;
    }[]): Promise<false | any[]>;
    /**
     * Show a prompt modal to the user.
     * @method _converse.api.prompt
     * @param { String } title - The header text for the prompt
     * @param { (Array<String>|String) } messages - The prompt text to show to the user
     * @param { String } placeholder - The placeholder text for the prompt input
     * @returns { Promise<String|false> } A promise which resolves with the text provided by the
     *  user or `false` if the user canceled the prompt.
     */
    function prompt(title: string, messages?: string | string[], placeholder?: string): Promise<string | false>;
    /**
     * Show an alert modal to the user.
     * @method _converse.api.alert
     * @param { ('info'|'warn'|'error') } type - The type of alert.
     * @param { String } title - The header text for the alert.
     * @param { (Array<String>|String) } messages - The alert text to show to the user.
     */
    function alert(type: "error" | "info" | "warn", title: string, messages: string | string[]): void;
}
//# sourceMappingURL=api.d.ts.map