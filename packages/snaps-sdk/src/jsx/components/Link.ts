import type { StandardFormattingElement } from './formatting';
import type { SnapsChildren } from '../component';
import { createSnapComponent } from '../component';

/**
 * The children of the {@link Link} component.
 */
export type LinkChildren = SnapsChildren<string | StandardFormattingElement>;

/**
 * The props of the {@link Link} component.
 *
 * @property children - The text to display in the link.
 * @property href - The URL to link to. This must be an `https` or `mailto` URL.
 * `http` is not allowed.
 */
export type LinkProps = {
  children: LinkChildren;
  href: string;
};

const TYPE = 'Link';

/**
 * A link component, which is used to display a hyperlink.
 *
 * @param props - The props of the component.
 * @param props.children - The text to display in the link.
 * @param props.href - The URL to link to. This must be an `https` or `mailto`
 * URL. `http` is not allowed.
 * @returns A link element.
 * @example
 * <Link href="https://example.com">Click here</Link>
 */
export const Link = createSnapComponent<LinkProps, typeof TYPE>(TYPE);

/**
 * A link element.
 *
 * @see Link
 */
export type LinkElement = ReturnType<typeof Link>;
