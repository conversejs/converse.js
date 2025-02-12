export type PubSubConfigOptions = {
    access_model?: 'authorize' | 'open' | 'presence' | 'roster' | 'whitelist';
    dataform_xslt?: string;
    deliver_notifications?: boolean;
    deliver_payloads?: boolean;
    item_expire?: string;
    max_items?: string;
    max_payload_size?: string;
    notification_type?: 'normal' | 'headline';
    notify_config?: boolean;
    notify_delete?: boolean;
    notify_retract?: boolean;
    notify_sub?: boolean;
    persist_items?: boolean;
    presence_based_delivery?: boolean;
    publish_model?: 'publishers' | 'subscribers' | 'open';
    purge_offline?: boolean;
    roster_groups_allowed?: string[];
    send_last_published_item?: 'never' | 'on_sub' | 'on_sub_and_presence';
    subscribe?: boolean;
    title?: string;
    type?: string;
};
//# sourceMappingURL=types.d.ts.map