/* global converse */
import mock from "../../../tests/mock.js";
const { u, Strophe, $iq, $msg, sizzle } = converse.env;

describe("XEP-0231: Bits of Binary", function() {

    describe("BOB Cache", function() {
        
        it("stores and retrieves BOB data", mock.initConverse(
            ['chatBoxesInitialized', 'BOBsInitialized'], {},
            async (_converse) => {
                const { api } = _converse;
                const cid = 'cid:sha1+8f35fef110ffc5df08d579a50083ff9308fb6242@bob.xmpp.org';
                const data = 'iVBORw0KGgoAAAANSUhEUg==';
                const type = 'image/png';
                
                // Store data
                api.bob.store(cid, data, type, 86400);
                
                // Verify it's cached
                expect(api.bob.has(cid)).toBe(true);
                
                // Retrieve as Blob URL
                const blobUrl = await api.bob.get(cid);
                expect(blobUrl).toBeTruthy();
                expect(blobUrl.startsWith('blob:')).toBe(true);
            }
        ));

        it("respects max-age expiration", mock.initConverse(
            ['chatBoxesInitialized', 'BOBsInitialized'], {},
            async (_converse) => {
                const { api } = _converse;
                const cid = 'cid:sha1+test@bob.xmpp.org';
                const data = 'iVBORw0KGgoAAAANSUhEUg==';
                
                // Store with 1 second max-age
                api.bob.store(cid, data, 'image/png', 1);
                expect(api.bob.has(cid)).toBe(true);
                
                // Wait 2 seconds
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Should be expired
                expect(api.bob.has(cid)).toBe(false);
            }
        ));

        it("rejects oversized data", mock.initConverse(
            ['chatBoxesInitialized', 'BOBsInitialized'], {},
            async (_converse) => {
                const { api } = _converse;
                const cid = 'cid:sha1+large@bob.xmpp.org';
                // Create valid base64 that decodes to >8KB (need ~12KB base64 for 9KB decoded)
                const largeData = btoa('A'.repeat(9000));
                
                api.bob.store(cid, largeData, 'image/png', 86400);
                
                // Should not be cached
                expect(api.bob.has(cid)).toBe(false);
            }
        ));

        it("rejects non-image MIME types", mock.initConverse(
            ['chatBoxesInitialized', 'BOBsInitialized'], {},
            async (_converse) => {
                const { api } = _converse;
                const cid = 'cid:sha1+pdf@bob.xmpp.org';
                const data = 'JVBERi0xLjQK';
                
                api.bob.store(cid, data, 'application/pdf', 86400);
                
                // Should not be cached
                expect(api.bob.has(cid)).toBe(false);
            }
        ));
    });

    describe("Message Parsing", function() {
        
        it("extracts BOB data from incoming messages", mock.initConverse(
            ['chatBoxesInitialized', 'BOBsInitialized'], {},
            async (_converse) => {
                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                
                const cid = 'cid:sha1+abc123@bob.xmpp.org';
                const bobData = 'iVBORw0KGgoAAAANSUhEUg==';
                
                const stanza = $msg({
                    from: contact_jid,
                    to: _converse.bare_jid,
                    type: 'chat'
                }).c('body').t(`Check this out! ${cid}`).up()
                  .c('data', {
                      xmlns: 'urn:xmpp:bob',
                      cid: cid,
                      type: 'image/png',
                      'max-age': '3600'
                  }).t(bobData);
                
                await _converse.handleMessageStanza(stanza.tree());
                
                // Verify data was cached
                expect(_converse.api.bob.has(cid)).toBe(true);
            }
        ));
    });

    describe("IQ Requests", function() {
        
        it("fetches uncached BOB data via IQ-get", mock.initConverse(
            ['chatBoxesInitialized', 'BOBsInitialized'], {},
            async (_converse) => {
                const { api } = _converse;
                const contact_jid = 'romeo@montague.lit';
                const cid = 'cid:sha1+fetch@bob.xmpp.org';
                const bobData = 'iVBORw0KGgoAAAANSUhEUg==';
                
                // Mock IQ response
                spyOn(api, 'sendIQ').and.returnValue(Promise.resolve(
                    $iq({type: 'result'})
                        .c('data', {
                            xmlns: 'urn:xmpp:bob',
                            cid: cid,
                            type: 'image/png',
                            'max-age': '3600'
                        }).t(bobData).tree()
                ));
                
                // Fetch data
                const blobUrl = await api.bob.get(cid, contact_jid);
                
                // Verify IQ was sent
                expect(api.sendIQ).toHaveBeenCalled();
                
                // Verify data was cached
                expect(api.bob.has(cid)).toBe(true);
                expect(blobUrl).toBeTruthy();
            }
        ));

        it("handles IQ errors gracefully", mock.initConverse(
            ['chatBoxesInitialized', 'BOBsInitialized'], {},
            async (_converse) => {
                const { api } = _converse;
                const contact_jid = 'romeo@montague.lit';
                const cid = 'cid:sha1+notfound@bob.xmpp.org';
                
                // Mock IQ error
                spyOn(api, 'sendIQ').and.returnValue(
                    Promise.reject(new Error('item-not-found'))
                );
                
                // Attempt to fetch
                const blobUrl = await api.bob.get(cid, contact_jid);
                
                // Should return null on error
                expect(blobUrl).toBeNull();
                expect(api.bob.has(cid)).toBe(false);
            }
        ));
    });
});
