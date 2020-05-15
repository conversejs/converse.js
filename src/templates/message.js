import { html } from 'lit-element';


export default (o) => html`
    <converse-chat-message
        .model=${o.model}
        .hats=${o.hats}
        ?retractable=${o.retractable}
        ?correcting=${o.model.get('correcting')}
        ?editable=${o.model.get('editable')}
        ?has_mentions=${o.has_mentions}
        ?is_delayed=${o.model.get('is_delayed')}
        ?is_encrypted=${o.model.get('is_encrypted')}
        ?is_me_message=${o.is_me_message}
        ?is_only_emojis=${o.model.get('is_only_emojis')}
        ?is_retracted=${o.is_retracted}
        ?is_spoiler=${o.model.get('is_spoiler')}
        ?is_spoiler_visible=${o.model.get('is_spoiler_visible')}
        from=${o.model.get('from')}
        moderated_by=${o.model.get('moderated_by') || ''}
        moderation_reason=${o.model.get('moderation_reason') || ''}
        msgid=${o.model.get('msgid')}
        occupant_affiliation=${o.model.occupant ? o.model.occupant.get('affiliation') : ''}
        occupant_role=${o.model.occupant ? o.model.occupant.get('role') : ''}
        oob_url=${o.model.get('oob_url') || ''}
        pretty_time=${o.pretty_time}
        pretty_type=${o.model.get('pretty_type')}
        received=${o.model.get('received')}
        sender=${o.model.get('sender')}
        spoiler_hint=${o.model.get('spoiler_hint') || ''}
        subject=${o.model.get('subject') || ''}
        time=${o.model.get('time')}
        message_type=${o.model.get('type')}
        username=${o.username}></converse-chat-message>
`;
