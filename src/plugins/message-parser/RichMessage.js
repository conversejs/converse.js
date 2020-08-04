import { convertASCII2Emoji } from "@converse/headless/converse-emoji.js";

/**
 * @class RichMessage
 * A String subclass that is used to represent the rich text
 * of a chat message.
 *
 * The "rich" parts of the text is represented by lit-html TemplateResult
 * objects which are added via the {@link RichMessage.addTemplateResult}
 * method and saved as metadata.
 *
 * By default Converse adds TemplateResults to support emojis, hyperlinks,
 * images, map URIs and mentions.
 *
 * 3rd party plugins can listen for the `beforeMessageBodyTransformed`
 * and/or `afterMessageBodyTransformed` events and then call
 * `addTemplateResult` on the RichMessage instance in order to add their own
 * rich features.
 */
class RichMessage extends String {

  /**
   * Create a new {@link RichMessage} instance.
   * @param { String } text - The plain text that was received from the `<message>` stanza.
   */
  constructor (text) {
      super(text);
      this.text = text;
      this.references = [];
  }

  /**
   * The "rich" markup parts of a chat message are represented by lit-html
   * TemplateResult objects.
   *
   * This method can be used to add new template results to this message's
   * text.
   *
   * @method RichMessage.addTemplateResult
   * @param { Number } begin - The starting index of the plain message text
   * which is being replaced with markup.
   * @param { Number } end - The ending index of the plain message text
   * which is being replaced with markup.
   * @param { Object } template - The lit-html TemplateResult instance
   */
  addTemplateResult (begin, end, template) {
      this.references.push({begin, end, template});
  }

  isMeCommand () {
      const text = this.toString();
      return !!text && text.startsWith('/me ');
  }

  // @TODO Find a better place for `convertASCII2Emoji`
  static replaceText (text) {
      return convertASCII2Emoji(text.replace(/\n\n+/g, '\n\n'));
  }

  marshall () {
      let list = [this.toString()];
      this.references
          .sort((a, b) => b.begin - a.begin)
          .forEach(ref => {
              const text = list.shift();
              list = [
                  text.slice(0, ref.begin),
                  ref.template,
                  text.slice(ref.end),
                  ...list
              ];
          });

      // Subtract `/me ` from 3rd person messages
      if (this.isMeCommand()) {
          list[0] = list[0].substring(4);
      }

      return list.reduce((acc, i) => typeof i === 'string' ? [...acc, RichMessage.replaceText(i)] : [...acc, i], []);
  }
}

export default RichMessage;
