import { dim } from 'chalk';

import { browserify } from './loaders';
import {
  WEBPACK_FALLBACKS,
  getBrowserslistTargets,
  getDefaultLoader,
  getDevTool,
  getFallbacks,
  getProgressHandler,
  pluralize,
  getEnvironmentVariables,
  formatText,
  getImageSVG,
} from './utils';
import type { ProcessedWebpackConfig } from '../config';
import { getMockConfig } from '../test-utils';

describe('getDefaultLoader', () => {
  it('returns the Browserify loader if `legacy` is set', async () => {
    const config = getMockConfig('browserify');
    expect(await getDefaultLoader(config)).toStrictEqual({
      loader: expect.stringContaining('function'),
      options: {
        ...config.legacy,
        fn: browserify,
      },
    });
  });

  it('returns the SWC loader if `legacy` is not set', async () => {
    const config = getMockConfig('webpack');
    expect(await getDefaultLoader(config)).toStrictEqual({
      loader: expect.stringContaining('swc-loader'),
      options: expect.any(Object),
    });
  });
});

describe('getDevTool', () => {
  it('returns `inline-source-map` when `sourceMap` is `inline`', () => {
    expect(getDevTool('inline')).toBe('inline-source-map');
  });

  it('returns `source-map` when `sourceMap` is `true`', () => {
    expect(getDevTool(true)).toBe('source-map');
  });

  it('returns `false` when `sourceMap` is `false`', () => {
    expect(getDevTool(false)).toBe(false);
  });
});

describe('getProgressHandler', () => {
  it('returns a function that updates the spinner text', () => {
    const spinner = {
      text: '',
    };

    // @ts-expect-error - Partial spinner object.
    const progressHandler = getProgressHandler(spinner, 'Building');

    progressHandler(0.5);
    expect(spinner.text).toBe(`Building ${dim('(50%)')}`);

    progressHandler(0.75);
    expect(spinner.text).toBe(`Building ${dim('(75%)')}`);
  });

  it('works without spinner', () => {
    const progressHandler = getProgressHandler();
    expect(() => progressHandler(0.5)).not.toThrow();
  });
});

describe('getBrowserslistTargets', () => {
  it('returns the default targets', async () => {
    const targets = await getBrowserslistTargets();
    expect(targets).toMatchInlineSnapshot(`
      [
        "chrome >= 90",
        "firefox >= 91",
      ]
    `);
  });
});

describe('pluralize', () => {
  it('pluralizes a word, based on the count', () => {
    expect(pluralize(0, 'test')).toBe('tests');
    expect(pluralize(1, 'test')).toBe('test');
    expect(pluralize(2, 'test')).toBe('tests');
  });

  it('returns the plural form if `plural` is set', () => {
    expect(pluralize(0, 'test', 'problems')).toBe('problems');
    expect(pluralize(1, 'test', 'problems')).toBe('test');
    expect(pluralize(2, 'test', 'problems')).toBe('problems');
  });
});

describe('getFallbacks', () => {
  it('disables all fallbacks if polyfills is set to false', () => {
    const fallbacks = getFallbacks(false);

    Object.keys(fallbacks).map((name) => expect(fallbacks[name]).toBe(false));
  });

  it('requires all the polyfills if polyfills is set to true', () => {
    const fallbacks = getFallbacks(true);

    Object.keys(fallbacks).map((name) =>
      expect(WEBPACK_FALLBACKS[name as keyof typeof WEBPACK_FALLBACKS]).toBe(
        WEBPACK_FALLBACKS[name as keyof typeof WEBPACK_FALLBACKS],
      ),
    );
  });

  it('disable or enable the polyfill if a polyfill config is passed', () => {
    const config = {
      buffer: true,
      crypto: false,
    } as ProcessedWebpackConfig['polyfills'];

    const fallbacks = getFallbacks(config);

    expect(fallbacks.buffer).toBe(WEBPACK_FALLBACKS.buffer);
    expect(fallbacks.crypto).toBe(false);
  });

  it("sets the fallbacks that we don't polyfill to false", () => {
    const fallbacks = getFallbacks(true);

    expect(fallbacks.fs).toBe(false);
  });
});

describe('getEnvironmentVariables', () => {
  it('returns the environment variables', () => {
    const env = getEnvironmentVariables({
      NODE_ENV: 'development',
      API_URL: 'https://example.com',
    });

    expect(env).toMatchInlineSnapshot(`
      {
        "process.env.API_URL": ""https://example.com"",
        "process.env.DEBUG": ""false"",
        "process.env.NODE_DEBUG": ""false"",
        "process.env.NODE_ENV": ""development"",
      }
    `);
  });
});

describe('formatText', () => {
  let originalColumns: number | undefined;
  beforeAll(() => {
    originalColumns = process.stdout.columns;
    process.stdout.columns = 40;
  });

  afterAll(() => {
    // @ts-expect-error - According to the type, `columns` cannot be undefined.
    process.stdout.columns = originalColumns;
  });

  it('formats the text', () => {
    expect(
      formatText(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam eget nulla mattis, sollicitudin enim tincidunt, vulputate libero. Pellentesque neque sapien, lobortis eu elit in, suscipit aliquet augue.',
        2,
      ),
    ).toMatchInlineSnapshot(`
      "  Lorem ipsum dolor sit amet,
        consectetur adipiscing elit. Nam eget
        nulla mattis, sollicitudin enim
        tincidunt, vulputate libero.
        Pellentesque neque sapien, lobortis eu
        elit in, suscipit aliquet augue."
    `);
  });

  it('formats the text with new lines', () => {
    expect(
      formatText(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam eget nulla mattis, sollicitudin enim tincidunt, vulputate libero.\nPellentesque neque sapien, lobortis eu elit in, suscipit aliquet augue.',
        2,
      ),
    ).toMatchInlineSnapshot(`
      "  Lorem ipsum dolor sit amet,
        consectetur adipiscing elit. Nam eget
        nulla mattis, sollicitudin enim
        tincidunt, vulputate libero.
        Pellentesque neque sapien, lobortis eu
        elit in, suscipit aliquet augue."
    `);
  });

  it('formats the text with a custom initial indentation', () => {
    process.stdout.columns = 40;
    expect(
      formatText(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam eget nulla mattis, sollicitudin enim tincidunt, vulputate libero. Pellentesque neque sapien, lobortis eu elit in, suscipit aliquet augue.',
        4,
        2,
      ),
    ).toMatchInlineSnapshot(`
      "  Lorem ipsum dolor sit amet,
          consectetur adipiscing elit. Nam
          eget nulla mattis, sollicitudin enim
          tincidunt, vulputate libero.
          Pellentesque neque sapien, lobortis
          eu elit in, suscipit aliquet augue."
    `);
  });

  it('indents the text if the terminal width is not set', () => {
    // @ts-expect-error - According to the type, `columns` cannot be undefined.
    process.stdout.columns = undefined;

    expect(
      formatText(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam eget nulla mattis, sollicitudin enim tincidunt, vulputate libero.\nPellentesque neque sapien, lobortis eu elit in, suscipit aliquet augue.',
        2,
      ),
    ).toMatchInlineSnapshot(`
      "  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam eget nulla mattis, sollicitudin enim tincidunt, vulputate libero.
        Pellentesque neque sapien, lobortis eu elit in, suscipit aliquet augue."
    `);
  });
});

describe('getImageSVG', () => {
  it('returns an SVG string for a PNG image', () => {
    const image = getImageSVG('image/png', new Uint8Array([1, 2, 3]));
    expect(image).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AQID" /></svg>"`,
    );
  });

  it('returns an SVG string for a JPEG image', () => {
    const image = getImageSVG('image/jpeg', new Uint8Array([1, 2, 3]));
    expect(image).toMatchInlineSnapshot(
      `"<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/jpeg;base64,AQID" /></svg>"`,
    );
  });
});
