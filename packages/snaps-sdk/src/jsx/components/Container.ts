import type { BoxElement } from './Box';
import type { FooterElement } from './Footer';
import { createSnapComponent } from '../component';

/**
 * The props of the {@link Container} component.
 *
 * @property children - The Box and the Footer or the Box element.
 */
export type ContainerProps = {
  children: [BoxElement, FooterElement] | BoxElement;
};

const TYPE = 'Container';

/**
 * A container component, which is used to create a container with a box and a footer.
 *
 * @param props - The props of the component.
 * @param props.children - The Box and the Footer or the Box element.
 * @returns A container element.
 * @example
 * <Container>
 *   <Box>
 *     <Text>Hello world!</Text>
 *   </Box>
 *   <Footer>
 *     <Button name="cancel">Cancel</Button>
 *     <Button name="confirm">Confirm</Button>
 *   </Footer>
 * </Container>
 */
export const Container = createSnapComponent<ContainerProps, typeof TYPE>(TYPE);

/**
 * A container element.
 *
 * @see Container
 */
export type ContainerElement = ReturnType<typeof Container>;
