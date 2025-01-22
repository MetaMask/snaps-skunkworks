import { FileInput } from './FileInput';

describe('FileInput', () => {
  it('renders a file input', () => {
    const result = <FileInput name="foo" accept={['image/png']} />;

    expect(result).toStrictEqual({
      type: 'FileInput',
      props: {
        name: 'foo',
        accept: ['image/png'],
      },
      key: null,
    });
  });

  it('renders a compact file input', () => {
    const result = <FileInput name="foo" compact />;

    expect(result).toStrictEqual({
      type: 'FileInput',
      props: {
        name: 'foo',
        compact: true,
      },
      key: null,
    });
  });

  it('renders disabled file input', () => {
    const result = <FileInput name="foo" disabled={true} />;

    expect(result).toStrictEqual({
      type: 'FileInput',
      props: {
        name: 'foo',
        disabled: true,
      },
      key: null,
    });
  });
});
