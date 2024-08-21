// eslint-disable-next-line import-x/unambiguous
declare module 'readable-stream' {
  export type {
    DuplexOptions,
    Readable,
    Writable,
    TransformCallback,
  } from 'stream';
  export { Duplex, pipeline } from 'stream';
}
