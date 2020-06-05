import { _converse, api, converse } from  "@converse/headless/converse-core";
import { directive, html } from "lit-html";
import { isString } from "lodash";

const u = converse.env.utils;


class MessageBodyRenderer extends String {

    constructor (component) {
        super();
        this.text = component.model.getMessageText();
        this.model = component.model;
        this.component = component;
    }

    async transform () {
        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * before the default transformations have been applied.
         * @event _converse#beforeMessageBodyTransformed
         * @param { _converse.Message } model - The model representing the message
         * @param { string } text - The message text
         * @example _converse.api.listen.on('beforeMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger('beforeMessageBodyTransformed', this.model, this.text, {'Synchronous': true});

        let text = this.component.is_me_message ? this.text.substring(4) : this.text;
        // Collapse multiple line breaks into at most two
        text = text.replace(/\n\n+/g, '\n\n');
        text = u.geoUriToHttp(text, _converse.geouri_replacement);

        const process = (text) => {
            text = u.addEmoji(text);
            return addMentionsMarkup(text, this.model.get('references'), this.model.collection.chatbox);
        }
        const list = await Promise.all(u.addHyperlinks(text));
        this.list = list.reduce((acc, i) => isString(i) ? [...acc, ...process(i)] : [...acc, i], []);
        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * after the default transformations have been applied.
         * @event _converse#afterMessageBodyTransformed
         * @param { _converse.Message } model - The model representing the message
         * @param { string } text - The message text
         * @example _converse.api.listen.on('afterMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger('afterMessageBodyTransformed', this.model, text, {'Synchronous': true});

        return this.list;
    }

    async render () {
        return html`${await this.transform()}`
    }

    get length () {
        return this.text.length;
    }

    toString () {
        return "" + this.text;
    }

    textOf () {
        return this.toString();
    }
}

const tpl_mention_with_nick = (o) => html`<span class="mention mention--self badge badge-info">${o.mention}</span>`;
const tpl_mention = (o) => html`<span class="mention">${o.mention}</span>`;


function addMentionsMarkup (text, references, chatbox) {
    if (chatbox.get('message_type') === 'groupchat' && references.length) {
        let list = [text];
        const nick = chatbox.get('nick');
        references
            .sort((a, b) => b.begin - a.begin)
            .forEach(ref => {
                const text = list.shift();
                const mention = text.slice(ref.begin, ref.end);
                if (mention === nick) {
                    list = [
                        text.slice(0, ref.begin),
                        tpl_mention_with_nick({mention}),
                        text.slice(ref.end),
                        ...list
                    ];
                } else {
                    list = [
                        text.slice(0, ref.begin),
                        tpl_mention({mention}),
                        text.slice(ref.end),
                        ...list
                    ];
                }
            });
        return list;
    } else {
        return [text];
    }
}


export const renderBodyText = directive(component => async part => {
    const model = component.model;
    const renderer = new MessageBodyRenderer(component);
    part.setValue(await renderer.render());
    part.commit();
    model.collection?.trigger('rendered', model);
});
