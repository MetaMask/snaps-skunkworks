import type { ButtonElement } from './form';
import { createSnapComponent } from '../component';

/**
 * The props of the {@link Footer} component.
 *
 * @property children - The single or multiple buttons in the footer.
 */
export type FooterProps = {
  children: ButtonElement | [ButtonElement, ButtonElement];
};

const TYPE = 'Footer';

/**
 * A footer component, which is used to create a footer with buttons.
 *
 * @param props - The props of the component.
 * @param props.children - The single or multiple buttons in the footer.
 * @returns A footer element.
 * @example
 * <Footer>
 *   <Button name="cancel">Cancel</Button>
 *   <Button name="confirm">Confirm</Button>
 * </Footer>
 */
export const Footer = createSnapComponent<FooterProps, typeof TYPE>(TYPE);

/**
 * A footer element.
 *
 * @see Footer
 */
export type FooterElement = ReturnType<typeof Footer>;
