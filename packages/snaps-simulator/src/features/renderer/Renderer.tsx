import type { JSXElement } from '@metamask/snaps-sdk/jsx';
import type { FunctionComponent } from 'react';

import { SnapComponent } from './SnapComponent';
import { SnapInterfaceContextProvider } from '../../contexts';
import { generateKey } from '../../utils';

type RendererProps = {
  content: JSXElement;
};

/**
 * A UI renderer for Snaps UI.
 *
 * @param props - The component props.
 * @param props.content - The JSX element to render.
 * @returns The renderer component.
 */
export const Renderer: FunctionComponent<RendererProps> = ({ content }) => {
  const id = generateKey({}, content);

  return (
    <SnapInterfaceContextProvider>
      <SnapComponent node={content} id={id} />
    </SnapInterfaceContextProvider>
  );
};
