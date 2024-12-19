export type PubSubConfigOptions = {
    'pubsub#access_model': 'authorize' | 'open' | 'presence' | 'roster' | 'whitelist';
    // Payload XSLT
    'pubsub#dataform_xslt'?: string;
    'pubsub#deliver_notifications': boolean;
    // Whether to deliver payloads with event notifications
    'pubsub#deliver_payloads': boolean;
    // Time after which to automatically purge items. `max` for no specific limit other than a server imposed maximum.
    'pubsub#item_expire': string;
    // Max # of items to persist. `max` for no specific limit other than a server imposed maximum.
    'pubsub#max_items': string;
    // Max Payload size in bytes
    'pubsub#max_payload_size': string;
    'pubsub#notification_type': 'normal' | 'headline';
    // Notify subscribers when the node configuration changes
    'pubsub#notify_config': boolean;
    // Notify subscribers when the node is deleted
    'pubsub#notify_delete': boolean;
    // Notify subscribers when items are removed from the node
    'pubsub#notify_retract': boolean;
    // <field var='pubsub#notify_sub' type='boolean'
    'pubsub#notify_sub': boolean;
    // <field var='pubsub#persist_items' type='boolean'
    'pubsub#persist_items': boolean;
    // Deliver event notifications only to available users
    'pubsub#presence_based_delivery': boolean;
    'pubsub#publish_model': 'publishers' | 'subscribers' | 'open';
    // Purge all items when the relevant publisher goes offline?
    'pubsub#purge_offline': boolean;
    'pubsub#roster_groups_allowed': string[];
    // When to send the last published item
    // - Never
    // - When a new subscription is processed
    // - When a new subscription is processed and whenever a subscriber comes online
    'pubsub#send_last_published_item': 'never' | 'on_sub' | 'on_sub_and_presence';
    // Whether to allow subscriptions
    'pubsub#subscribe': boolean;
    // A friendly name for the node'/>
    'pubsub#title': string;
    // Specify the semantic type of payload data to be provided at this node.
    'pubsub#type': string;
};
