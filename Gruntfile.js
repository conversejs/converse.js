module.exports = function(grunt) {
    grunt.initConfig({
        jshint: {
        options: {
            trailing: true
        },
        target: {
            src : [
                'converse.js',
                'mock.js',
                'main.js',
                'tests_main.js',
                'spec/*.js'
            ]
        }
        }
    });
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.registerTask('default', ['jshint']);
};
