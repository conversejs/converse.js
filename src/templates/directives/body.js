import { MessageText } from '../../shared/message/text.js';
import { api, converse } from  "@converse/headless/converse-core";
import { directive, html } from "lit-html";
import { until } from 'lit-html/directives/until.js';


const u = converse.env.utils;


class MessageBodyRenderer {

    constructor (component) {
        this.model = component.model;
        this.component = component;
        this.chatview = u.ancestor(this.component, 'converse-chat-message')?.chatview;
        // We jot down whether we were scrolled down before rendering, because when an
        // image loads, it triggers 'scroll' and the chat will be marked as scrolled,
        // which is technically true, but not what we want because the user
        // didn't initiate the scrolling.
        this.was_scrolled_up = this.chatview.model.get('scrolled');
        this.text = this.component.model.getMessageText();
    }

    scrollDownOnImageLoad () {
        if (!this.was_scrolled_up) {
            this.chatview.scrollDown();
        }
    }

    async transform () {
        const show_images = api.settings.get('show_images_inline');
        const offset = 0;
        const text = new MessageText(
            this.text,
            this.model,
            offset,
            show_images,
            () => this.scrollDownOnImageLoad(),
            ev => this.component.showImageModal(ev)
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
