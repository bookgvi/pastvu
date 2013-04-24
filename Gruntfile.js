module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		exec: {
			buildjs: {
				command: 'node build.js',
				stdout: true,
				stderr: true
			}
		},
		concat: {
			options: {
				separator: ';',
				stripBanners: true,
				banner: '/**\n' +
					' * Hello, inquiring mind!\n' +
					' * This is application of <%= pkg.description %>.\n' +
					' * Version: <%= pkg.version %>, <%= grunt.template.today("dd.mm.yyyy") %>\n' +
					' * Author: <%= pkg.author %>\n' +
					' */\n'
			},
			dist: {
				src: ['public-build/js/lib/require/require.js', 'public-build/js/_mainConfig.js', 'public-build/js/appMain.js'],
				dest: 'public-build/js/appMain.js'
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-requirejs');
	grunt.loadNpmTasks('grunt-exec');

	// Default task(s).
	grunt.registerTask('default', ['exec', 'concat']);
};