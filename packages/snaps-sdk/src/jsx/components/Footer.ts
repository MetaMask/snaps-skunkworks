import { createSnapComponent } from '../component';
import type { ButtonElement } from './form';

/**
 * The props of the {@link Footer} component.
 *
 * @property children - The single or multiple buttons in the footer.
 * @property requireScroll - Controls whether footer buttons require all content to be viewed before becoming active.
 */
export type FooterProps = {
  children: ButtonElement | [ButtonElement, ButtonElement];
  requireScroll?: boolean | undefined;
};

const TYPE = 'Footer';

/**
 * A footer component, which is used to create a footer with buttons.
 *
 * @param props - The props of the component.
 * @param props.requireScroll - Controls whether footer buttons require all content to be viewed before becoming active.
 * The prop also activates an arrow that allows you to scroll to bottom.
 * @param props.children - The single or multiple buttons in the footer.
 * @returns A footer element.
 * @example
 * <Footer>
 *   <Button name="cancel">Cancel</Button>
 *   <Button name="confirm">Confirm</Button>
 * </Footer>
 * @example
 * <Footer requireScroll>
 *   <Button name="accept">Accept</Button>
 * </Footer>
 */
export const Footer = createSnapComponent<FooterProps, typeof TYPE>(TYPE);

/**
 * A footer element.
 *
 * @see Footer
 */
export type FooterElement = ReturnType<typeof Footer>;
