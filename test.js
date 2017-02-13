import fs from 'fs';
import getStream from 'get-stream';
import gutil from 'gulp-util';
import path from 'path';
import pify from 'pify';
import test from 'ava';

import zorroSvg from './';

const fsPromise = pify(fs);

const createFixture = async () => {
  const buffer = await fsPromise.readFile('test/water.png');
  const stream = zorroSvg();

  stream.end(new gutil.File({
    path: path.join(__dirname, 'test/water.png'),
    contents: buffer
  }));

  return {buffer, stream};
};

test('generate alpha masks', async (t) => {
  const {buffer, stream} = await createFixture();
  const file = await getStream.array(stream);

  t.true(file[0].contents.length < buffer.length);
});

test('skip unsupported images', async (t) => {
  const stream = zorroSvg();
  stream.end(new gutil.File({path: path.join(__dirname, 'test/water.jpg')}));
  const file = await getStream.array(stream);

  t.is(file[0].contents, null);
});
