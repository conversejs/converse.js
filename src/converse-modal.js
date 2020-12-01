/**
 * @module converse-modal
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import Alert from './modals/alert.js';
import BootstrapModal from './modals/base.js';
import Confirm from './modals/confirm.js';
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, converse } from "@converse/headless/converse-core";


converse.env.BootstrapModal = BootstrapModal; // expose to plugins


let alert;

const modal_api = {
    /**
     * Show a confirm modal to the user.
     * @method _converse.api.confirm
     * @param { String } title - The header text for the confirmation dialog
     * @param { (String[]|String) } messages - The text to show to the user
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
     * @param { (String[]|String) } messages - The prompt text to show to the user
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
     * @param { (String[]|String) } messages - The alert text to show to the user.
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

        if (alert === undefined) {
            const model = new Model({
                'title': title,
                'messages': messages,
                'level': level,
                'type': 'alert'
            })
            alert = new Alert({model});
        } else {
            alert.model.set({
                'title': title,
                'messages': messages,
                'level': level
            });
        }
        alert.show();
    }
}


converse.plugins.add('converse-modal', {

    initialize () {
        _converse.api.listen.on('disconnect', () => {
            const container = document.querySelector("#converse-modals");
            if (container) {
                container.innerHTML = '';
            }
        });
        Object.assign(_converse.api, modal_api);
    }
});
