import { html } from 'lit-html';
import { pipe } from '@converse/headless/utils/functional';
import RichMessage from './RichMessage';
import log from '@converse/headless/log';

class MessageParser {

    constructor () {
        this._filters = [];
        this._middleware = [];
    }

    get filters () {
        return this._filters;
    }

    get middleware () {
        return this._middleware;
    }

    static checkReferenceCollision (reference, rich_message) {
        const collides = rich_message.references.some(msg_ref => {
          const is_after = reference.begin > msg_ref.end;
          const is_before = reference.end < msg_ref.begin;
          return !is_after && !is_before;
        });
        return collides;
    }

    static makeTemplateResultFromString (string_or_templateresult) {
        const is_template_result = !!string_or_templateresult.getTemplateElement;
        return is_template_result
          ? string_or_templateresult
          : html`${string_or_templateresult}`;
    }

    static addSingleReferenceToMessage (reference, rich_message) {
        if (!MessageParser.isReferenceCollition(reference, rich_message)) {
            const { begin, end, template } = reference;
            const template_result = MessageParser.makeTemplateResultFromString(template);
            rich_message.addTemplateResult(begin, end, template_result);
        } else {
            throw new Error('Reference collision');
        }
    }

    static addReferencesToMessage (references, rich_message) {
        references.forEach(reference =>
            MessageParser.addSingleReferenceToMessage(reference, rich_message)
        );
    }

    addFilters (...filters) {
        this._filters.push(...filters);
    }

    addMiddleware (...middleware) {
        this._middleware.push(...middleware);
    }

    richMessageFromText (text) {
        return new RichMessage(text);
    }

    runFilters (text) {
        return pipe(...this.filters)(text);
    }

    runMiddleware (rich_message) {
        this.middleware.forEach(middleware => {
            try {
                const references = middleware(rich_message.text);
                MessageParser.addReferencesToMessage(references, rich_message);
            } catch (error) {
                // log.error(`Reference collision caused by middleware "${middleware.name}"`)
            }
        });
    }

    toTransform (rich_message) {
        return rich_message.marshall();
    }

}

export default MessageParser;
