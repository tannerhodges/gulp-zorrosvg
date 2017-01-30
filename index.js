const chalk = require('chalk');
const gutil = require('gulp-util');
const path = require('path');
const plur = require('plur');
const sharp = require('sharp');
const through = require('through2-concurrent');
const async = require('async');

const PLUGIN_NAME = require('./package.json').name;
const VALID_EXTS = ['.png'];

/**
 * Get SVG content.
 * @param  {Vinyl}   file
 * @param  {Buffer}  output
 * @param  {object}  info
 * @return {Buffer}
 */
function getSvg(file, output, info) {
  let newFile = new gutil.File({
    cwd: file.cwd,
    base: file.base,
    path: file.path,
    contents: new Buffer(`<svg width="${info.width}" height="${info.height/2}" viewBox="0 0 ${info.width} ${info.height/2}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <filter id="zorrosvg" primitiveUnits="objectBoundingBox">
      <feOffset in="SourceGraphic" result="bottom-half" dy="-0.5"></feOffset>
      <feColorMatrix type="matrix" in="bottom-half" result="alpha-mask" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 0 0"></feColorMatrix>
      <feComposite in="SourceGraphic" in2="alpha-mask" operator="in"></feComposite>
    </filter>
  </defs>
  <image width="100%" height="200%" filter="url(#zorrosvg)" xlink:href="data:image/jpeg;base64,${output.toString('base64')}"></image>
</svg>`)
  });

  newFile.basename = newFile.basename.replace('.png', '.svg');

  return newFile;
}

/**
 * Generate ZorroSVG alpha masks from PNGs.
 *
 * Based on the following plugins:
 * https://github.com/sindresorhus/gulp-imagemin/blob/master/index.js
 * https://github.com/mahnunchik/gulp-responsive/blob/master/lib/index.js
 *
 * @param  {object}  options
 */
module.exports = (options) => {
  options = Object.assign({
    verbose: process.argv.indexOf('--verbose') !== -1
  }, options);

  let totalFiles = 0;

  return through.obj((file, encoding, callback) => {
    if (file.isNull()) {
      callback(null, file);
      return;
    }

    if (file.isStream()) {
      callback(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
      return;
    }

    if (VALID_EXTS.indexOf(path.extname(file.path).toLowerCase()) === -1) {
      if (options.verbose) {
        gutil.log(`${PLUGIN_NAME}: Skipping unsupported image ${chalk.blue(file.relative)}`);
      }
      callback(null, file);
      return;
    }

    /**
     * ZorroSVG.
     * Note: Assumes image has an alpha channel.
     */
    let image = sharp(file.contents);
    let errorPrefix = `${chalk.red('✘')} File \`${file.relative}\`: `;

    // Create a white-out copy of the image
    image.clone().threshold(1).toBuffer((error, output, info) => {
      if (error) {
        error.message = errorPrefix + error.message;
        return callback(new gutil.PluginError(PLUGIN_NAME, error, { showStack: true }));
      }

      // Resize the canvas to fit both images
      return image.extend({ top: 0, right: 0, bottom: info.height, left: 0 })
        // Paste the white-out copy
        .overlayWith(output, { top: info.height, left: 0 })
        // Save as JPG
        .jpeg()
        .toBuffer(function(error, output, info) {
          if (error) {
            error.message = errorPrefix + error.message;
            return callback(new gutil.PluginError(PLUGIN_NAME, error, { showStack: true }));
          }

          let newFile = getSvg(file, output, info);

          totalFiles++;

          if (options.verbose) {
            gutil.log(`${PLUGIN_NAME}: ${chalk.green('✔')} ${chalk.blue(file.relative + ' -> ' + newFile.relative)}`);
          }

          // TODO: Responsive sizes
          callback(null, newFile);
        });
    });
  }, callback => {
    gutil.log(`${PLUGIN_NAME}: Generated ${totalFiles} alpha ${plur('mask', totalFiles)}.`);
    callback();
  });
};
