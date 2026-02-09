export type XMPPProvider = {
    jid: string;
    category: string;
    ratingXmppComplianceTester?: number;
    freeOfCharge?: boolean;
    inBandRegistration?: boolean;
    registrationWebPage?: { [key: string]: string };
    professionalHosting?: boolean;
    serverLocations?: string[];
    since?: string;
    serverSoftwareName?: string;
    organization?: string;
    passwordReset?: { [key: string]: string };
    legalNotice?: { [key: string]: string };
    maximumHttpFileUploadFileSize?: number;
    maximumHttpFileUploadStorageTime?: number;
    maximumMessageArchiveManagementStorageTime?: number;
}
