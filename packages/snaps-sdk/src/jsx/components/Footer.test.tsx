import { Footer } from './Footer';
import { Button } from './form';

describe('Footer', () => {
  it('renders a footer element with a button', () => {
    const result = (
      <Footer>
        <Button name="confirm">Confirm</Button>
      </Footer>
    );

    expect(result).toStrictEqual({
      type: 'Footer',
      key: null,
      props: {
        children: {
          type: 'Button',
          key: null,
          props: {
            name: 'confirm',
            children: 'Confirm',
          },
        },
      },
    });
  });

  it('renders a footer element with multiple buttons', () => {
    const result = (
      <Footer requireScroll>
        <Button name="cancel">Cancel</Button>
        <Button name="confirm">Confirm</Button>
      </Footer>
    );

    expect(result).toStrictEqual({
      type: 'Footer',
      key: null,
      props: {
        requireScroll: true,
        children: [
          {
            type: 'Button',
            key: null,
            props: {
              name: 'cancel',
              children: 'Cancel',
            },
          },
          {
            type: 'Button',
            key: null,
            props: {
              name: 'confirm',
              children: 'Confirm',
            },
          },
        ],
      },
    });
  });
});
