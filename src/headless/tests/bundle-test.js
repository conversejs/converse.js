describe("The Headless Bundle", function() {
    it("should load properly", function() {
        expect(window.converse).toBeDefined();
        expect(window.converse.env).toBeDefined();
        expect(window.converse.initialize).toBeDefined();
    });
});
