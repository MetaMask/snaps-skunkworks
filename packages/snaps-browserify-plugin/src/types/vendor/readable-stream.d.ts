// eslint-disable-next-line import-x/unambiguous
declare module 'readable-stream' {
  export type {
    DuplexOptions,
    Readable,
    Writable,
    TransformCallback,
  } from 'stream';
  export { Transform, Duplex, pipeline } from 'stream';
}
