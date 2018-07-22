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
 * Wrap image and luminance mask in a ZorroSVG file.
 * @see https://github.com/Quasimondo/QuasimondoJS/blob/ce7ffb317f7435940046d5ff46a7503f92efd328/zorrosvg/js/zorrosvgmaskmaker.js#L400-L449
 * @param  {Buffer}  buffer
 * @param  {Object}  params  {cwd, base, path, width, height}
 * @return {Buffer}
 */
function getSvg(buffer, params) {
  return new gutil.File({
    cwd: params.cwd,
    base: params.base,
    path: params.path.replace('.png', '.svg'),
    contents: Buffer.from(`<svg width="${params.width}" height="${params.height / 2}" viewBox="0 0 ${params.width} ${params.height / 2}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <filter id="zorrosvg" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
      <feOffset in="SourceGraphic" result="bottom-half" dy="-0.5"></feOffset>
      <feColorMatrix type="matrix" in="bottom-half" result="luma-mask" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0"></feColorMatrix>
      <feComposite in="SourceGraphic" in2="luma-mask" operator="in"></feComposite>
    </filter>
  </defs>
  <image width="100%" height="200%" filter="url(#zorrosvg)" xlink:href="data:image/jpeg;base64,${buffer.toString('base64')}"></image>
</svg>`)
  });
}

/**
 * Generate ZorroSVG luminance masks from PNGs.
 * @see https://github.com/Quasimondo/QuasimondoJS/blob/ce7ffb317f7435940046d5ff46a7503f92efd328/zorrosvg/js/zorrosvgmaskmaker.js#L176-L277
 * @param  {Object}  options
 */
module.exports = (options) => {
  "use strict";

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
     * @note Assumes image has an alpha channel.
     * @see  https://github.com/Quasimondo/QuasimondoJS/tree/ce7ffb317f7435940046d5ff46a7503f92efd328/zorrosvg
     */
    let image = sharp(file.contents);
    let errorPrefix = `${chalk.red('✘')} File \`${file.relative}\`: `;

    // Create a canvas 2x the height of the original image.
    // Keep the original image on top and paste a copy of it on the bottom.
    image.toBuffer(function(error, imageBuffer, imageInfo) {
      if (error) {
        error.message = errorPrefix + error.message;
        return callback(new gutil.PluginError(PLUGIN_NAME, error, { showStack: true }));
      }
      // Force transparent background
      return image.background({ r: 0, g: 0, b: 0, alpha: 0 })
      // Double canvas height
        .extend({ top: 0, right: 0, bottom: imageInfo.height, left: 0 })
      // Paste image
        .overlayWith(imageBuffer, { top: imageInfo.height, left: 0 })
      // Get raw pixel data to manipulate
        .raw().toBuffer(function(error, compositeBuffer, compositeInfo) {
        if (error) {
          error.message = errorPrefix + error.message;
          return callback(new gutil.PluginError(PLUGIN_NAME, error, { showStack: true }));
        }

        // Make the original image fully opaque
        for (let i = 0; i < compositeBuffer.length / 2; i = i + 4) {
          compositeBuffer[i + 3] = 255;
        }
        // Create a luminance mask based on the original image's alpha channel
        // Add gamma correction for semi-transparent pixels
        for (let i = compositeBuffer.length / 2; i < compositeBuffer.length; i = i + 4) {
          let alpha = compositeBuffer[i + 3];
          compositeBuffer[i + 0] = alpha;
          compositeBuffer[i + 1] = alpha;
          compositeBuffer[i + 2] = alpha;
          compositeBuffer[i + 3] = 255;
        }

        // Compress as JPG
        sharp(compositeBuffer, { raw: { width: compositeInfo.width, height: compositeInfo.height, channels: compositeInfo.channels } })
          .jpeg().toBuffer(function(error, finalBuffer, finalInfo) {
          if (error) {
            error.message = errorPrefix + error.message;
            return callback(new gutil.PluginError(PLUGIN_NAME, error, { showStack: true }));
          }

          // Final SVG conversion
          let newFile = getSvg(finalBuffer, {
            cwd: file.cwd,
            base: file.base,
            path: file.path,
            width: finalInfo.width,
            height: finalInfo.height
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
    gutil.log(`${PLUGIN_NAME}: Generated ${totalFiles} ZorroSVG ${plur('file', totalFiles)}.`);
    callback();
  });
};
