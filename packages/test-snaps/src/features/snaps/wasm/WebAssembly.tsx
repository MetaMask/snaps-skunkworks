import type { FunctionComponent } from 'react';

import { FibonacciInput } from './components';
import { WASM_SNAP_ID, WASM_SNAP_PORT, WASM_VERSION } from './constants';
import { Snap } from '../../../components';

export const WASM: FunctionComponent = () => {
  return (
    <Snap
      name="WebAssembly Snap"
      snapId={WASM_SNAP_ID}
      port={WASM_SNAP_PORT}
      version={WASM_VERSION}
      testId="wasm"
    >
      <FibonacciInput />
    </Snap>
  );
};
