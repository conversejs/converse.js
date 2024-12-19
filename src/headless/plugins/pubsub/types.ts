export type PubSubConfigOptions = {
    access_model: 'authorize' | 'open' | 'presence' | 'roster' | 'whitelist';
    // Payload XSLT
    dataform_xslt?: string;
    deliver_notifications: boolean;
    // Whether to deliver payloads with event notifications
    deliver_payloads: boolean;
    // Time after which to automatically purge items. `max` for no specific limit other than a server imposed maximum.
    item_expire: string;
    // Max # of items to persist. `max` for no specific limit other than a server imposed maximum.
    max_items: string;
    // Max Payload size in bytes
    max_payload_size: string;
    notification_type: 'normal' | 'headline';
    // Notify subscribers when the node configuration changes
    notify_config: boolean;
    // Notify subscribers when the node is deleted
    notify_delete: boolean;
    // Notify subscribers when items are removed from the node
    notify_retract: boolean;
    // <field var='notify_sub' type='boolean'
    notify_sub: boolean;
    // <field var='persist_items' type='boolean'
    persist_items: boolean;
    // Deliver event notifications only to available users
    presence_based_delivery: boolean;
    publish_model: 'publishers' | 'subscribers' | 'open';
    // Purge all items when the relevant publisher goes offline?
    purge_offline: boolean;
    roster_groups_allowed: string[];
    // When to send the last published item
    // - Never
    // - When a new subscription is processed
    // - When a new subscription is processed and whenever a subscriber comes online
    send_last_published_item: 'never' | 'on_sub' | 'on_sub_and_presence';
    // Whether to allow subscriptions
    subscribe: boolean;
    // A friendly name for the node'/>
    title: string;
    // Specify the semantic type of payload data to be provided at this node.
    type: string;
};
