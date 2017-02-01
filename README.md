# gulp-zorrosvg

Generate [ZorroSVG](http://quasimondo.com/ZorroSVG/) files from PNGs.

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

## Credits

- [Mario Klingemann](http://quasimondo.com/) for creating [ZorroSVG](http://quasimondo.com/ZorroSVG/), coining the name, and making things dead-simple with the magic combination of `feOffset`, `feColorMatrix`, and `feComposite`.
- [Shaw](http://codepen.io/shshaw/) for creating [JPG+PNG to SVG Mask](http://codepen.io/shshaw/pen/tKpdl), taking it to the next level with data URIs, and documenting browser support in [SVG+Images Browser Test](http://codepen.io/shshaw/pen/IDbqC).
- [Peter Hrynkow](http://peterhrynkow.com/) for sharing [Using SVG to Shrink Your PNGS](http://peterhrynkow.com/how-to-compress-a-png-like-a-jpeg/) and implementing the technique on [sapporobeer.ca](http://sapporobeer.ca/) in the first place.
- [Smashing Magazine](https://www.smashingmagazine.com/) for sharing “Using SVG to Shrink Your PNGS” in [Smashing Newsletter #118](http://web.archive.org/web/20160418010611/https://www.smashingmagazine.com/smashing-newsletter-issue-118/#a3).
- [Dirk Weber](http://codepen.io/DirkWeber/) for penning [this example](http://codepen.io/DirkWeber/pen/DtJvf) that sparked my imagination.
- [Yoksel](http://codepen.io/yoksel/) for an [amazing list of masking techniques](http://codepen.io/yoksel/pen/fsdbu) that got me started on this journey.
