var gulp = require('gulp'),
    nodemon = require('gulp-nodemon'),
    livereload = require('gulp-livereload'),
    sourcemaps = require('gulp-sourcemaps'),
    gulpPlumber = require('gulp-plumber'),
    merge = require('merge2'),
    ts = require('gulp-typescript');

gulp.task('typescript', function() {
    var tsProject = ts.createProject('tsconfig.json');

    var tsResult = gulp.src(['src/**/*.ts']) 
        .pipe(gulpPlumber())
        .pipe(sourcemaps.init())
        .pipe(tsProject());

    // merge dts & js output streams...
    return merge([
        // type definitions
        tsResult.dts
            .pipe(gulp.dest("./dist/")),
          // javascript
        tsResult.js
            //.pipe(sourcemaps.write(writeOptions))
            .pipe(gulp.dest('./dist/'))
        ])
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./dist/'));

});

gulp.task('serve', ['typescript'], function () {

    gulp.watch('./src/**/*.ts', ['typescript']);

    livereload.listen();

    nodemon({
        script: './bin/www',
        ext: 'js',
    }).on('restart', function () {
        setTimeout(function () {
            console.log("reload!");
            livereload.reload();
        }, 500);
    });

});