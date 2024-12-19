export type PubSubConfigOptions = {
    'pubsub#access_model': 'authorize' | 'open' | 'presence' | 'roster' | 'whitelist';
    'pubsub#dataform_xslt'?: string;
    'pubsub#deliver_notifications': boolean;
    'pubsub#deliver_payloads': boolean;
    'pubsub#item_expire': string;
    'pubsub#max_items': string;
    'pubsub#max_payload_size': string;
    'pubsub#notification_type': 'normal' | 'headline';
    'pubsub#notify_config': boolean;
    'pubsub#notify_delete': boolean;
    'pubsub#notify_retract': boolean;
    'pubsub#notify_sub': boolean;
    'pubsub#persist_items': boolean;
    'pubsub#presence_based_delivery': boolean;
    'pubsub#publish_model': 'publishers' | 'subscribers' | 'open';
    'pubsub#purge_offline': boolean;
    'pubsub#roster_groups_allowed': string[];
    'pubsub#send_last_published_item': 'never' | 'on_sub' | 'on_sub_and_presence';
    'pubsub#subscribe': boolean;
    'pubsub#title': string;
    'pubsub#type': string;
};
//# sourceMappingURL=types.d.ts.map