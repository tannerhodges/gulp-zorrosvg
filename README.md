# gulp-zorrosvg

Generate ZorroSVG alpha masks from PNGs.

## Install

```bash
npm install --save-dev gulp-zorrosvg
```

## Usage

```js
const gulp = require('gulp');
const zorrosvg = require('gulp-zorrosvg');

gulp.task('zorrosvg', () =>
  gulp.src('resources/assets/img/zorrosvg/*.png')
    .pipe(zorrosvg())
    .pipe(gulp.dest('public/img/zorrosvg'))
);
```
