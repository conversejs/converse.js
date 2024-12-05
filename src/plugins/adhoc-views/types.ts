import { AdHocCommand, AdHocCommandResult } from '@converse/headless/plugins/adhoc/types';

export type AdHocUIProps = {
    instructions: string;
    jid: string;
    alert?: string;
    alert_type: 'danger'|'primary';
    name: 'cancel'|'complete'|'execute'|'next'|'prev';
}

export type AdHocCommandUIProps = AdHocCommand & AdHocCommandResult & AdHocUIProps;
