/* global api, log, converse */
const { isDomainWhitelisted, isDomainAllowed, isMediaURLDomainAllowed, shouldRenderMediaFromURL } = converse.env.utils;

describe("URL Utility Functions", () => {
    describe("isDomainWhitelisted", () => {
        it("should return true for exact domain match", () => {
            const whitelist = ["example.com"];
            expect(isDomainWhitelisted(whitelist, "https://example.com/path")).toBe(true);
        });

        it("should return true for subdomain match", () => {
            const whitelist = ["example.com"];
            expect(isDomainWhitelisted(whitelist, "https://sub.example.com/path")).toBe(true);
        });

        it("should return false for non-matching domain", () => {
            const whitelist = ["example.com"];
            expect(isDomainWhitelisted(whitelist, "https://other.com/path")).toBe(false);
        });

        it("should handle multiple whitelist entries", () => {
            const whitelist = ["example.com", "test.org"];
            expect(isDomainWhitelisted(whitelist, "https://test.org/path")).toBe(true);
        });
    });

    describe("isDomainAllowed", () => {

        it("should return true when setting is not an array",
            mock.initConverse(
                ['chatBoxesFetched'], {'allowed_video_domains': 'conversejs.org'},
                async function (_converse) {

            expect(isDomainAllowed("https://conversejs.org", "allowed_domains")).toBe(true);
        }));

        it("should return false for non-allowed domain",
            mock.initConverse(
                ['chatBoxesFetched'], {'allowed_video_domains': ['conversejs.org']},
                async function (_converse) {

            expect(isDomainAllowed("https://conversejs.com", "allowed_video_domains")).toBe(false);
        }));

        it("should return false for invalid URL",
            mock.initConverse(
                ['chatBoxesFetched'], {'allowed_video_domains': ['conversejs.org']},
                async function (_converse) {
            expect(isDomainAllowed("invalid-url", "allowed_video_domains")).toBe(false);
        }));
    });

    describe("shouldRenderMediaFromURL", () => {
        it("should allow http/https protocols",
            mock.initConverse(
                ['chatBoxesFetched'], { allowed_image_domains: ['conversejs.org']},
                async function (_converse) {
            expect(shouldRenderMediaFromURL("https://conversejs.org/img.jpg", "image")).toBe(true);
            expect(shouldRenderMediaFromURL("http://conversejs.org/img.jpg", "image")).toBe(true);
        }));

        it("should allow chrome-extension and file protocols",
            mock.initConverse(
                ['chatBoxesFetched'], { allowed_image_domains: ['conversejs.org']},
                async function (_converse) {
            expect(shouldRenderMediaFromURL("chrome-extension://conversejs.org/img.jpg", "image")).toBe(true);
        }));

        it("should reject other protocols", () => {
            expect(shouldRenderMediaFromURL("ftp://image.com/img.jpg", "image")).toBe(false);
        });
    });
});
