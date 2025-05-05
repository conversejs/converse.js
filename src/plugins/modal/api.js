import './alert.js';
import Confirm from './confirm.js';
import { Model } from '@converse/skeletor';
import { api } from '@converse/headless';

let modals = [];
let modals_map = {};

let toasts_map = {};

const modal_api = {
    /**
     * API namespace for methods relating to modals
     * @namespace _converse.api.modal
     * @memberOf _converse.api
     */
    modal: {
        /**
         * Shows a modal of type `ModalClass` to the user.
         * Will create a new instance of that class if an existing one isn't
         * found.
         * @param {string|any} name
         * @param {Object} [properties] - Optional properties that will be set on a newly created modal instance.
         * @param {Event} [ev] - The DOM event that causes the modal to be shown.
         */
        show(name, properties, ev) {
            let modal;
            if (typeof name === 'string') {
                modal = this.get(name) ?? this.create(name, properties);
                Object.assign(modal, properties);
            } else {
                // Legacy...
                const ModalClass = name;
                const id = ModalClass.id ?? properties.id;
                modal = this.get(id) ?? this.create(ModalClass, properties);
            }
            modal.show(ev);
            return modal;
        },

        /**
         * Return a modal with the passed-in identifier, if it exists.
         * @param {String} id
         */
        get(id) {
            return modals_map[id] ?? modals.filter((m) => m.id == id).pop();
        },

        /**
         * Create a modal of the passed-in type.
         * @param {String} name
         * @param {Object} [properties] - Optional properties that will be
         *  set on the modal instance.
         */
        create(name, properties) {
            const ModalClass = customElements.get(name);
            const modal = (modals_map[name] = new ModalClass(properties));
            return modal;
        },

        /**
         * Remove a particular modal
         * @param {String} name
         */
        remove(name) {
            let modal;
            if (typeof name === 'string') {
                modal = modals_map[name];
                delete modals_map[name];
            } else {
                // Legacy...
                modal = name;
                modals = modals.filter((m) => m !== modal);
            }
            modal?.remove();
        },

        /**
         * Remove all modals
         */
        removeAll() {
            modals.forEach((m) => m.remove());
            modals = [];
            modals_map = {};
        },
    },

    /**
     * Show a confirm modal to the user.
     * @method _converse.api.confirm
     * @param {String} title - The header text for the confirmation dialog
     * @param {(Array<String>|String)} messages - The text to show to the user
     * @param {Array<import('./types').Field>} fields - An object representing a field presented to the user.
     * @returns {Promise<Array|false>} A promise which resolves with an array of
     *  filled in fields or `false` if the confirm dialog was closed or canceled.
     */
    async confirm(title, messages = [], fields = []) {
        if (typeof messages === 'string') {
            messages = [messages];
        }
        const model = new Model({ title, messages, fields, 'type': 'confirm' });
        const confirm = new Confirm({ model });
        confirm.show();
        let result;
        try {
            result = await confirm.confirmation;
        } catch (e) {
            result = false;
        }
        confirm.remove();
        return result;
    },

    /**
     * Show a prompt modal to the user.
     * @method _converse.api.prompt
     * @param { String } title - The header text for the prompt
     * @param { (Array<String>|String) } messages - The prompt text to show to the user
     * @param { String } placeholder - The placeholder text for the prompt input
     * @returns { Promise<String|false> } A promise which resolves with the text provided by the
     *  user or `false` if the user canceled the prompt.
     */
    async prompt(title, messages = [], placeholder = '') {
        if (typeof messages === 'string') {
            messages = [messages];
        }
        const model = new Model({
            title,
            messages,
            fields: [
                {
                    'name': 'reason',
                    'placeholder': placeholder,
                },
            ],
            type: 'prompt',
        });
        const prompt = new Confirm({ model });
        prompt.show();
        let result;
        try {
            result = (await prompt.confirmation).pop()?.value;
        } catch (e) {
            result = false;
        }
        prompt.remove();
        return result;
    },

    /**
     * Show an alert modal to the user.
     * @method _converse.api.alert
     * @param { ('info'|'warn'|'error') } type - The type of alert.
     * @param { String } title - The header text for the alert.
     * @param { (Array<String>|String) } messages - The alert text to show to the user.
     */
    alert(type, title, messages) {
        if (typeof messages === 'string') {
            messages = [messages];
        }
        let level;
        if (type === 'error') {
            level = 'alert-danger';
        } else if (type === 'info') {
            level = 'alert-info';
        } else if (type === 'warn') {
            level = 'alert-warning';
        }

        const model = new Model({ title, messages, level, 'type': 'alert' });
        modal_api.modal.show('converse-alert-modal', { model });
    },

    /**
     * API namespace for methods relating to toast messages
     * @namespace _converse.api.toast
     * @memberOf _converse.api
     */
    toast: {
        /**
         * @param {string} name
         * @param {import('./types').ToastProperties} [properties] - Optional properties that will be set on a newly created toast instance.
         */
        show(name, properties) {
            toasts_map[name] = properties;
            api.trigger('showToast', properties);
        },

        /**
         * @param {String} [name]
         */
        get(name) {
            if (name) {
                return toasts_map[name];
            } else {
                return Object.keys(toasts_map).map((name) => ({ name, ...toasts_map[name] }));
            }
        },

        /**
         * @param {String} [name]
         */
        remove(name) {
            delete toasts_map[name];
            api.trigger('hideToast');
        },
    },
};

export default modal_api;
