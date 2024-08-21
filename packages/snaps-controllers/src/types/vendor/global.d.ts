export {};

// eslint-disable-next-line import-x/unambiguous
declare global {
  class DecompressionStream extends TransformStream<Uint8Array, Uint8Array> {
    constructor(format?: string);
  }
}
