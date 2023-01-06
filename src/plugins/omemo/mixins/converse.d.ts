export default ConverseMixins;
declare namespace ConverseMixins {
    function generateFingerprints(jid: any): Promise<any>;
    function getDeviceForContact(jid: any, device_id: any): Promise<any>;
    function contactHasOMEMOSupport(jid: any): Promise<boolean>;
}
