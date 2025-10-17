/*global mock, converse */

describe('i18n', () => {
    describe('translate', () => {
        it("can translate strings with placeholders",
            mock.initConverse([], {}, async function (_converse) {
                const { __ } = _converse.env.i18n;
                const translated = __('Hello %1$s', 'world');
                expect(translated).toBe('Hello world');
            })
        );
    });

    describe('determineLocale', () => {
        it("returns the preferred locale if supported",
            mock.initConverse([], {
                locales: ['en', 'es', 'fr'],
                i18n: 'es'
            }, async function (_converse) {
                const { i18n } = _converse.env;
                const locale = i18n.determineLocale();
                expect(locale).toBe('es');
            })
        );

        it("supports regional dialects",
            mock.initConverse([], {
                locales: ['en', 'pt_BR', 'pt'],
                i18n: 'pt_BR'
            }, async function (_converse) {
                const { i18n } = _converse.env;
                Object.defineProperty(navigator, 'languages', {
                    value: ['pt-BR'],
                    configurable: true,
                });
                const locale = i18n.determineLocale();
                expect(locale).toBe('pt_BR');
            })
        );

        it("falls back to the non-regional version",
            mock.initConverse([], {
                locales: ['en', 'pt'],
                i18n: 'pt_BR'
            }, async function (_converse) {
                const { i18n } = _converse.env;
                Object.defineProperty(navigator, 'languages', {
                    value: ['pt-BR'],
                    configurable: true,
                });
                const locale = i18n.determineLocale();
                expect(locale).toBe('pt');
            })
        );

        it("falls back to browser language if preferred not supported",
            mock.initConverse([], {
                locales: ['en', 'es', 'fr'],
                i18n: 'de'
            }, async function (_converse) {
                const { i18n } = _converse.env;
                Object.defineProperty(navigator, 'languages', {
                    value: ['fr-FR', 'fr', 'en-US', 'en'],
                    configurable: true,
                });
                const locale = i18n.determineLocale();
                expect(locale).toBe('fr');
            })
        );

        it("falls back to \"en\" if no supported locale found",
            mock.initConverse([], {
                locales: ['en', 'es', 'fr'],
                i18n: 'ja'
            }, async function (_converse) {
                const { i18n } = _converse.env;
                Object.defineProperty(navigator, 'languages', {
                    value: ['de', 'it'],
                    configurable: true,
                });
                const locale = i18n.determineLocale();
                expect(locale).toBe('en');
            })
        );
    });
});
