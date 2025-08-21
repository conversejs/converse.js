export default apps_api;
declare namespace apps_api {
    namespace apps {
        /**
         * @param {import('./types').App} app
         */
        export function add(app: import("./types").App): void;
        /**
         * @returns {import('./types').App}
         */
        export function getActive(): import("./types").App;
        /**
         * @param {string} name
         */
        function _switch(name: string): any;
        export { _switch as switch };
    }
}
//# sourceMappingURL=api.d.ts.map