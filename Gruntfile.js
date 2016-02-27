module.exports = function(grunt) {
    grunt.initConfig({
        jst: {
            compile: {
                options: {
                    namespace: 'templates',
                    templateSettings: {
                        evaluate : /\{\[([\s\S]+?)\]\}/g,
                        interpolate : /\{\{([\s\S]+?)\}\}/g
                    },
                    processName: function (filepath) {
                        // E.g. src/templates/trimmed_chat.html
                        return filepath.match(/src\/templates\/([a-z_]+)\.html/)[1];

                    }
                },
                files: {
                    "builds/templates.js": ["src/templates/*.html"]
                },
            }
        },
        cssmin: {
            options: {
                banner: "/*"+
                        "* Converse.js (Web-based XMPP instant messaging client) \n"+
                        "* http://conversejs.org \n"+
                        "* Copyright (c) 2012, Jan-Carel Brand <jc@opkode.com> \n"+
                        "* Dual licensed under the MIT and GPL Licenses \n"+
                        "*/"
            },
            minify: {
                dest: 'css/converse.min.css',
                src: ['css/converse.css']
            }
        }
    });
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-jst');
};
