import type { Options } from 'yargs';

import type { ProcessedConfig } from '../config';

// eslint-disable-next-line @typescript-eslint/ban-types
type OptionalArguments<Type = {}> = Type & {
  /** Non-option arguments */
  _?: (string | number)[];

  /** The script name or node command */
  $0?: string;

  /** All remaining options */
  [argName: string]: unknown;
};

type YargsArgs = {
  // Context is added by the config middleware.
  context: {
    config: ProcessedConfig;
  };

  fix?: boolean;
  input?: string;

  config?: string;
  sourceMaps: boolean;
  stripComments: boolean;
  transformHtmlComments: boolean;
  port: number;
  host: string;
  dist: string;
  src: string;
  eval: boolean;
  outfileName: string;
  serve: boolean;
  directory?: string;
} & OptionalArguments;

type Option = {
  stripComments: boolean;
  transformHtmlComments: boolean;
} & Options;
