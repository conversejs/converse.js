/** Converse.js
 *
 *  An XMPP chat client that runs in the browser.
 *
 *  Version: 3.2.1
 */

/* jshint ignore:start */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define([], factory);
    } else {
        //Browser globals case.
        root.converse = factory();
    }
}(this, function () {
    //almond, and your modules will be inlined here
/* jshint ignore:end */
