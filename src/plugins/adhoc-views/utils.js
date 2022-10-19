import log from "@converse/headless/log";
import { api, converse } from "@converse/headless/core";

const { Strophe, $iq, sizzle, u } = converse.env;

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
            .map(f => u.xForm2TemplateResult(f, cmd_el, { domain: jid }));

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
