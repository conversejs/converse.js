import { MessageText } from '../../shared/message/text.js';
import { api } from  "@converse/headless/core";
import { directive, html } from "lit-html";
import { until } from 'lit-html/directives/until.js';


class MessageBodyRenderer {

    constructor (component) {
        this.model = component.model;
        this.component = component;
        this.text = this.model.getMessageText();
    }

    onImageLoaded () {
        this.component.dispatchEvent(new CustomEvent('imageLoaded', { detail: this.component, 'bubbles': true }));
    }

    async transform () {
        const show_images = api.settings.get('show_images_inline');
        const render_styling = !this.model.get('is_unstyled') && api.settings.get('allow_message_styling');
        const offset = 0;
        const text = new MessageText(
            this.text,
            offset,
            this.model.get('references'),
            {
                'nick': this.model.collection.chatbox.get('nick'),
                'onImgClick': () => this.onImageLoaded(),
                'onImgLoad': ev => this.component.showImageModal(ev),
                render_styling,
                show_images,
            }
        );
        await text.addTemplates();
        return text.payload;
    }

    render () {
        return html`${until(this.transform(), html`${this.text}`)}`;
    }
}


export const renderBodyText = directive(component => part => {
    const renderer = new MessageBodyRenderer(component);
    part.setValue(renderer.render());
    const model = component.model;
    model.collection?.trigger('rendered', model);
});
