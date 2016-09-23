module.exports = function(grunt) {
    grunt.initConfig({
        json: {
            main: {
                options: {
                    namespace: 'locales',
                    includePath: true,
                    processName: function(filename) {
                        return filename.toLowerCase().match(/^locale\/(.*)\/lc_messages/)[1];
                    }
                },
                src: ['locale/**/LC_MESSAGES/*.json'],
                dest: 'dist/locales.js'
            }
        }
    });
    grunt.loadNpmTasks('grunt-json');
};
