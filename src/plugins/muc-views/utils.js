import { _converse, api, converse } from "@converse/headless/core";
import log from "@converse/headless/log";

const { Strophe, $iq, sizzle, u } = converse.env;


export function getAutoCompleteListItem (text, input) {
    input = input.trim();
    const element = document.createElement('li');
    element.setAttribute('aria-selected', 'false');

    if (api.settings.get('muc_mention_autocomplete_show_avatar')) {
        const img = document.createElement('img');
        let dataUri = 'data:' + _converse.DEFAULT_IMAGE_TYPE + ';base64,' + _converse.DEFAULT_IMAGE;

        if (_converse.vcards) {
            const vcard = _converse.vcards.findWhere({ 'nickname': text });
            if (vcard) dataUri = 'data:' + vcard.get('image_type') + ';base64,' + vcard.get('image');
        }

        img.setAttribute('src', dataUri);
        img.setAttribute('width', '22');
        img.setAttribute('class', 'avatar avatar-autocomplete');
        element.appendChild(img);
    }

    const regex = new RegExp('(' + input + ')', 'ig');
    const parts = input ? text.split(regex) : [text];

    parts.forEach(txt => {
        if (input && txt.match(regex)) {
            const match = document.createElement('mark');
            match.textContent = txt;
            element.appendChild(match);
        } else {
            element.appendChild(document.createTextNode(txt));
        }
    });

    return element;
}

export async function getAutoCompleteList () {
    const models = [...(await api.rooms.get()), ...(await api.contacts.get())];
    const jids = [...new Set(models.map(o => Strophe.getDomainFromJid(o.get('jid'))))];
    return jids;
}

export async function fetchCommandForm (command) {
    const node = command.node;
    const jid = command.jid;
    const stanza = $iq({
        'type': 'set',
        'to': jid
    }).c('command', {
        'xmlns': Strophe.NS.ADHOC,
        'node': node,
        'action': 'execute'
    });
    try {
        const iq = await api.sendIQ(stanza);
        const cmd_el = sizzle(`command[xmlns="${Strophe.NS.ADHOC}"]`, iq).pop();
        command.sessionid = cmd_el.getAttribute('sessionid');
        command.instructions = sizzle('x[type="form"][xmlns="jabber:x:data"] instructions', cmd_el).pop()?.textContent;
        command.fields = sizzle('x[type="form"][xmlns="jabber:x:data"] field', cmd_el)
            .map(f => u.xForm2TemplateResult(f, cmd_el));

    } catch (e) {
        if (e === null) {
            log.error(`Error: timeout while trying to execute command for ${jid}`);
        } else {
            log.error(`Error while trying to execute command for ${jid}`);
            log.error(e);
        }
        command.fields = [];
    }
}
