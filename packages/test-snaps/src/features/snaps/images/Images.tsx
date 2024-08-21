import type { FunctionComponent } from 'react';

import { ShowImage, ShowQr } from './components';
import { IMAGES_SNAP_ID, IMAGES_SNAP_PORT, IMAGES_VERSION } from './constants';
import { Snap } from '../../../components';

export const Images: FunctionComponent = () => {
  return (
    <Snap
      name="Images Snap"
      snapId={IMAGES_SNAP_ID}
      port={IMAGES_SNAP_PORT}
      version={IMAGES_VERSION}
      testId="images"
    >
      <ShowImage name="Cat" method="getCat" />
      <ShowImage name="SVG" method="getSvgIcon" />
      <ShowImage name="PNG" method="getPngIcon" />
      <ShowQr />
    </Snap>
  );
};
