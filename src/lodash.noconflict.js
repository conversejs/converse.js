/*global define */
define(['lodash'], function (_) {
    if (!_.isUndefined(require) && !_.isUndefined(require.s)) {
        /* XXX: This is a hack to make sure that the compiled templates have
         * access to the _ object.
         *
         * Otherwise we sometimes get errors like this:
         *
         *    TypeError: Cannot read property 'escape' of undefined
         *     at eval (./src/templates/chatroom_sidebar.html:6)
         */
        var lodashLoader = require.s.contexts._.config.lodashLoader;
        lodashLoader.templateSettings.imports = { '_': _ };
        require.config({'lodashLoader': lodashLoader});
    }
    return _.noConflict();
});
