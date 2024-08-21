import type { FunctionComponent } from 'react';

import {
  HOME_PAGE_SNAP_ID,
  HOME_PAGE_SNAP_PORT,
  HOME_PAGE_VERSION,
} from './constants';
import { Snap } from '../../../components';

export const HomePage: FunctionComponent = () => {
  return (
    <Snap
      name="Home Page Snap"
      snapId={HOME_PAGE_SNAP_ID}
      port={HOME_PAGE_SNAP_PORT}
      version={HOME_PAGE_VERSION}
      testId="homepage"
    />
  );
};
