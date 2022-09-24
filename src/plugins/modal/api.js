import './alert.js';
import Confirm from './confirm.js';
import { Model } from '@converse/skeletor/src/model.js';

let modals = [];
let modals_map = {};

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
         * @param { Class } ModalClass
         * @param { Object } [properties] - Optional properties that will be set on a newly created modal instance.
         * @param { Event } [event] - The DOM event that causes the modal to be shown.
         */
        show (name, properties, ev) {
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
         * @param { String } id
         */
        get (id) {
            return modals_map[id] ?? modals.filter(m => m.id == id).pop();
        },

        /**
         * Create a modal of the passed-in type.
         * @param { String } name
         * @param { Object } [properties] - Optional properties that will be
         *  set on the modal instance.
         */
        create (name, properties) {
            let modal;
            if (typeof name === 'string') {
                const ModalClass = customElements.get(name);
                modal = modals_map[name] = new ModalClass(properties);
            } else {
                // Legacy...
                const ModalClass = name;
                modal = new ModalClass(properties);
                modals.push(modal);
            }
            return modal;
        },

        /**
         * Remove a particular modal
         * @param { String } name
         */
        remove (name) {
            let modal;
            if (typeof name === 'string') {
                modal = modals_map[name];
                delete modals_map[name];
            } else {
                // Legacy...
                modal = name;
                modals = modals.filter(m => m !== modal);
            }
            modal?.remove();
        },

        /**
         * Remove all modals
         */
        removeAll () {
            modals.forEach(m => m.remove());
            modals = [];
            modals_map = {};
        }
    },

    /**
     * Show a confirm modal to the user.
     * @method _converse.api.confirm
     * @param { String } title - The header text for the confirmation dialog
     * @param { (Array<String>|String) } messages - The text to show to the user
     * @param { Array<Field> } fields - An object representing a fields presented to the user.
     * @property { String } Field.label - The form label for the input field.
     * @property { String } Field.name - The name for the input field.
     * @property { String } [Field.challenge] - A challenge value that must be provided by the user.
     * @property { String } [Field.placeholder] - The placeholder for the input field.
     * @property { Boolean} [Field.required] - Whether the field is required or not
     * @returns { Promise<Array|false> } A promise which resolves with an array of
     *  filled in fields or `false` if the confirm dialog was closed or canceled.
     */
    async confirm (title, messages=[], fields=[]) {
        if (typeof messages === 'string') {
            messages = [messages];
        }
        const model = new Model({title, messages, fields, 'type': 'confirm'})
        const confirm = new Confirm({model});
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
    async prompt (title, messages=[], placeholder='') {
        if (typeof messages === 'string') {
            messages = [messages];
        }
        const model = new Model({
            title,
            messages,
            'fields': [{
                'name': 'reason',
                'placeholder': placeholder,
            }],
            'type': 'prompt'
        })
        const prompt = new Confirm({model});
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
    alert (type, title, messages) {
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

        const model = new Model({
            'title': title,
            'messages': messages,
            'level': level,
            'type': 'alert'
        })
        modal_api.modal.show('converse-alert-modal', { model });
    }
}

export default modal_api;
