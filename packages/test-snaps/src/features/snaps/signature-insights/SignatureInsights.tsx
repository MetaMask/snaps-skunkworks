import type { FunctionComponent } from 'react';

import {
  SIGNATURE_INSIGHTS_SNAP_ID,
  SIGNATURE_INSIGHTS_SNAP_PORT,
  SIGNATURE_INSIGHTS_VERSION,
} from './constants';
import { Snap } from '../../../components';

export const SignatureInsights: FunctionComponent = () => {
  return (
    <Snap
      name="Signature Insights Snap"
      snapId={SIGNATURE_INSIGHTS_SNAP_ID}
      port={SIGNATURE_INSIGHTS_SNAP_PORT}
      version={SIGNATURE_INSIGHTS_VERSION}
      testId="signature-insights"
    />
  );
};
