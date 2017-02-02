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
 * @param  {Buffer}  buffer
 * @param  {Object}  params  {cwd, base, path, width, height}
 * @return {Buffer}
 */
function getSvg(buffer, params) {
  let newFile = new gutil.File({
    cwd: params.cwd,
    base: params.base,
    path: params.path,
    contents: new Buffer(`<svg width="${params.width}" height="${params.height/2}" viewBox="0 0 ${params.width} ${params.height/2}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <filter id="zorrosvg" primitiveUnits="objectBoundingBox">
      <feOffset in="SourceGraphic" result="bottom-half" dy="-0.5"></feOffset>
      <feColorMatrix type="matrix" in="bottom-half" result="alpha-mask" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 0 0"></feColorMatrix>
      <feComposite in="SourceGraphic" in2="alpha-mask" operator="in"></feComposite>
    </filter>
  </defs>
  <image width="100%" height="200%" filter="url(#zorrosvg)" xlink:href="data:image/jpeg;base64,${buffer.toString('base64')}"></image>
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
 * @param  {Object}  options
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
    let width, height, channels;
    let errorPrefix = `${chalk.red('✘')} File \`${file.relative}\`: `;

    // Get image metadata so we can convert buffer from `raw()` back to a sharp instance
    // https://github.com/lovell/sharp/issues/552#issuecomment-243452196
    image.metadata(function(error, metadata) {
      width = metadata.width;
      height = metadata.height;
      channels = metadata.channels;
    // Get a copy of the image's raw pixel data
    }).clone().raw().toBuffer((error, buffer, info) => {
      if (error) {
        error.message = errorPrefix + error.message;
        return callback(new gutil.PluginError(PLUGIN_NAME, error, { showStack: true }));
      }

      // Create a luminance mask based on the image's alpha channel
      for (var i = 0; i < buffer.length; i += 4) {
        buffer[i + 0] = buffer[i + 3];
        buffer[i + 1] = buffer[i + 3];
        buffer[i + 2] = buffer[i + 3];
        buffer[i + 3] = 255;
      }

      // Convert buffer back to a sharp instance
      sharp(buffer, { raw: { width: width, height: height, channels: channels } })
        .png().toBuffer(function(error, buffer, info) {
        if (error) {
          error.message = errorPrefix + error.message;
          return callback(new gutil.PluginError(PLUGIN_NAME, error, { showStack: true }));
        }

        // Resize the canvas to fit both images
        return image
          .background({ r: 255, g: 255, b: 255, alpha: 1 })
          .extend({ top: 0, right: 0, bottom: info.height, left: 0 })
          // Paste the luminance mask at the bottom
          .overlayWith(buffer, { top: info.height, left: 0 })
          // Compress as JPG
          .jpeg().toBuffer(function(error, buffer, info) {
          if (error) {
            error.message = errorPrefix + error.message;
            return callback(new gutil.PluginError(PLUGIN_NAME, error, { showStack: true }));
          }

          // Final SVG conversion
          let newFile = getSvg(buffer, {
            cwd: file.cwd,
            base: file.base,
            path: file.path,
            width: info.width,
            height: info.height
          });

          totalFiles++;

          if (options.verbose) {
            gutil.log(`${PLUGIN_NAME}: ${chalk.green('✔')} ${chalk.blue(file.relative + ' -> ' + newFile.relative)}`);
          }

          // TODO: Responsive sizes
          callback(null, newFile);
        });
      });
    });
  }, callback => {
    gutil.log(`${PLUGIN_NAME}: Generated ${totalFiles} alpha ${plur('mask', totalFiles)}.`);
    callback();
  });
};
