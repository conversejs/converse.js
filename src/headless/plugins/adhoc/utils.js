import sizzle from 'sizzle';
import { converse } from "@converse/headless/core";
import { getAttributes } from '@converse/headless/shared/parsers';

const { Strophe, u } = converse.env;

export function parseForCommands (stanza) {
    const items = sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"][node="${Strophe.NS.ADHOC}"] item`, stanza);
    return items.map(getAttributes)
}

export function getCommandFields (iq, jid) {
    const cmd_el = sizzle(`command[xmlns="${Strophe.NS.ADHOC}"]`, iq).pop();
    const data = {
        sessionid: cmd_el.getAttribute('sessionid'),
        instructions: sizzle('x[type="form"][xmlns="jabber:x:data"] instructions', cmd_el).pop()?.textContent,
        fields: sizzle('x[type="form"][xmlns="jabber:x:data"] field', cmd_el)
            .map(f => u.xForm2TemplateResult(f, cmd_el, { domain: jid })),
        actions: Array.from(cmd_el.querySelector('actions')?.children).map((a) => a.nodeName.toLowerCase()) ?? []
    }
    return data;
}
