import { is } from '@metamask/superstruct';

import {
  Address,
  Bold,
  Box,
  Button,
  Copyable,
  Divider,
  Dropdown,
  Option,
  RadioGroup,
  Radio,
  Field,
  Form,
  Heading,
  Image,
  Input,
  Italic,
  Link,
  Row,
  Spinner,
  Text,
  Tooltip,
  Value,
  FileInput,
  Checkbox,
  Footer,
  Container,
  Card,
  Icon,
  Selector,
  SelectorOption,
  Section,
  Avatar,
  Banner,
  Skeleton,
} from './components';
import {
  AddressStruct,
  assertJSXElement,
  BoldStruct,
  BoxStruct,
  ButtonStruct,
  CardStruct,
  CheckboxStruct,
  ContainerStruct,
  CopyableStruct,
  DividerStruct,
  DropdownStruct,
  RadioGroupStruct,
  ElementStruct,
  FieldStruct,
  FileInputStruct,
  FooterStruct,
  FormStruct,
  HeadingStruct,
  ImageStruct,
  InputStruct,
  isJSXElement,
  isJSXElementUnsafe,
  ItalicStruct,
  KeyStruct,
  LinkStruct,
  RowStruct,
  SpinnerStruct,
  StringElementStruct,
  TextStruct,
  TooltipStruct,
  ValueStruct,
  IconStruct,
  SelectorStruct,
  SectionStruct,
  AvatarStruct,
  BannerStruct,
  SkeletonStruct,
} from './validation';

describe('KeyStruct', () => {
  it.each(['foo', 42])('validates a key', (value) => {
    expect(is(value, KeyStruct)).toBe(true);
  });

  it.each([null, undefined, {}, []])('does not validate "%p"', (value) => {
    expect(is(value, KeyStruct)).toBe(false);
  });
});

describe('StringElementStruct', () => {
  it('validates a string value', () => {
    expect(is('foo', StringElementStruct)).toBe(true);
  });

  it('validates an array of string elements', () => {
    expect(is(['foo', 'bar'], StringElementStruct)).toBe(true);
  });

  it.each([undefined, {}])('does not validate "%p"', (value) => {
    expect(is(value, StringElementStruct)).toBe(false);
  });
});

describe('ElementStruct', () => {
  it.each([
    {
      type: 'text',
      props: {
        children: 'foo',
      },
      key: null,
    },
    {
      type: 'box',
      props: {
        children: {
          type: 'text',
          props: {
            children: 'foo',
          },
        },
      },
      key: null,
    },
    {
      type: 'row',
      props: {
        label: 'label',
      },
      key: null,
    },
  ])('validates an element', (value) => {
    expect(is(value, ElementStruct)).toBe(true);
  });

  it.each([
    {
      type: 'text',
      props: {
        children: 'foo',
      },
    },
    {
      type: 'box',
      props: {
        children: {
          type: 'text',
          props: {
            children: 'foo',
          },
        },
      },
    },
    {
      type: 'row',
      props: {
        label: 'label',
      },
    },
  ])('does not validate "%p"', (value) => {
    expect(is(value, ElementStruct)).toBe(false);
  });
});

describe('ButtonStruct', () => {
  it.each([
    <Button>foo</Button>,
    <Button name="foo">bar</Button>,
    <Button type="submit">foo</Button>,
    <Button variant="destructive">foo</Button>,
    <Button disabled={true}>foo</Button>,
    <Button variant="primary" loading={true}>
      foo
    </Button>,
    <Button key="button">foo</Button>,
    <Button>
      <Icon name="wifi" />
    </Button>,
    <Button>
      <Image src="<svg></svg>" />
    </Button>,
    <Button form="foo">bar</Button>,
    <Button size="sm">bar</Button>,
  ])('validates a button element', (value) => {
    expect(is(value, ButtonStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Button />,
    // @ts-expect-error - Invalid props.
    <Button variant="foo">bar</Button>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, ButtonStruct)).toBe(false);
  });
});

describe('InputStruct', () => {
  it.each([
    <Input name="foo" type="text" />,
    <Input name="foo" type="text" disabled={true} />,
    <Input name="foo" type="password" />,
    <Input name="foo" type="password" disabled={true} />,
    <Input name="foo" type="number" />,
    <Input name="foo" type="number" disabled={true} />,
    <Input name="foo" type="text" value="bar" />,
    <Input name="foo" type="text" placeholder="bar" />,
    <Input name="foo" type="number" min={0} max={10} step={1} />,
  ])('validates an input element', (value) => {
    expect(is(value, InputStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Input />,
    // @ts-expect-error - Invalid props.
    <Input name="foo" type="foo" />,
    // @ts-expect-error - Invalid props.
    <Input name="foo" min="foo" />,
    // @ts-expect-error - Invalid props.
    <Input name="foo" type="text" min={42} />,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, InputStruct)).toBe(false);
  });
});

describe('FieldStruct', () => {
  it.each([
    <Field label="foo">
      <Input name="foo" type="text" />
    </Field>,
    <Field label="foo">
      <Box>
        <Text>Hello</Text>
      </Box>
      <Input name="foo" type="text" />
    </Field>,
    <Field label="foo">
      <Input name="foo" type="text" />
      <Box>
        <Text>Hello</Text>
      </Box>
    </Field>,
    <Field label="foo">
      <Box>
        <Text>Hello</Text>
      </Box>
      <Input name="foo" type="text" />
      <Box>
        <Text>Hello</Text>
      </Box>
    </Field>,
    <Field label="foo">
      <Text>Hello</Text>
      <Input name="foo" type="text" />
      <Text>Hello</Text>
    </Field>,
    <Field label="foo">
      <Input name="foo" type="text" />
      <Button>foo</Button>
    </Field>,
    <Field error="bar">
      <Input name="foo" type="text" />
    </Field>,
    <Field label="foo">
      <Dropdown name="foo">
        <Option value="option1">Option 1</Option>
        <Option value="option2">Option 2</Option>
      </Dropdown>
    </Field>,
    <Field label="foo">
      <RadioGroup name="foo">
        <Radio value="option1">Option 1</Radio>
        <Radio value="option2">Option 2</Radio>
      </RadioGroup>
    </Field>,
    <Field label="foo">
      <Checkbox name="foo" />
    </Field>,
    <Field label="foo">
      <Selector name="foo" title="Choose an option">
        <SelectorOption value="option1">
          <Card title="Foo" value="$1" />
        </SelectorOption>
        <SelectorOption value="option2">
          <Card title="bar" value="$1" />
        </SelectorOption>
      </Selector>
    </Field>,
  ])('validates a field element', (value) => {
    expect(is(value, FieldStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Field />,
    <Field label="foo" error="bar">
      <Text>foo</Text>
    </Field>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, FieldStruct)).toBe(false);
  });
});

describe('FormStruct', () => {
  it.each([
    <Form name="foo">
      <Field label="foo">
        <Input name="foo" type="text" />
        <Button>foo</Button>
      </Field>
    </Form>,
    <Form name="foo">
      <Field label="foo">
        <Input name="foo" type="text" />
      </Field>
    </Form>,
    <Form name="foo">
      <Field error="foo">
        <Input name="foo" type="text" />
        <Button>foo</Button>
      </Field>
    </Form>,
    <Form name="foo">
      <Field error="foo">
        <Input name="foo" type="text" />
      </Field>
    </Form>,
  ])('validates a form element', (value) => {
    expect(is(value, FormStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Form />,
    <Form name="foo">
      <Field label="foo">
        <Text>foo</Text>
      </Field>
    </Form>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, FormStruct)).toBe(false);
  });
});

describe('BoldStruct', () => {
  it.each([<Bold>hello</Bold>])('validates a bold element', (value) => {
    expect(is(value, BoldStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Bold />,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, BoldStruct)).toBe(false);
  });
});

describe('ItalicStruct', () => {
  it.each([<Italic>hello</Italic>, <Italic key="italic">hello</Italic>])(
    'validates an italic element',
    (value) => {
      expect(is(value, ItalicStruct)).toBe(true);
    },
  );

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Italic />,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, ItalicStruct)).toBe(false);
  });
});

describe('AvatarStruct', () => {
  it.each([
    <Avatar address="eip155:1:0x1234567890abcdef1234567890abcdef12345678" />,
    <Avatar address="bip122:000000000019d6689c085ae165831e93:128Lkh3S7CkDTBZ8W7BbpsN3YYizJMp8p6" />,
    <Avatar address="cosmos:cosmoshub-3:cosmos1t2uflqwqe0fsj0shcfkrvpukewcw40yjj6hdc0" />,
    <Avatar
      address="eip155:1:0x1234567890abcdef1234567890abcdef12345678"
      size="lg"
    />,
  ])('validates an avatar element', (value) => {
    expect(is(value, AvatarStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Avatar />,
    // @ts-expect-error - Invalid props.
    <Avatar>
      <Text>foo</Text>
    </Avatar>,
    // @ts-expect-error - Invalid props.
    <Avatar address="0x1234567890abcdef1234567890abcdef12345678" />,
    // @ts-expect-error - Invalid props.
    <Avatar address="0x1234" />,
    <Avatar
      address="eip155:1:0x1234567890abcdef1234567890abcdef12345678"
      // @ts-expect-error - Invalid props.
      size="foo"
    />,
    <Avatar address="a:b:0x1234" />,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, AvatarStruct)).toBe(false);
  });
});

describe('AddressStruct', () => {
  it.each([
    <Address address="0x1234567890abcdef1234567890abcdef12345678" />,
    <Address address="eip155:1:0x1234567890abcdef1234567890abcdef12345678" />,
    <Address address="bip122:000000000019d6689c085ae165831e93:128Lkh3S7CkDTBZ8W7BbpsN3YYizJMp8p6" />,
    <Address address="cosmos:cosmoshub-3:cosmos1t2uflqwqe0fsj0shcfkrvpukewcw40yjj6hdc0" />,
    <Address
      address="0x1234567890abcdef1234567890abcdef12345678"
      truncate={false}
      avatar={false}
    />,
    <Address
      address="0x1234567890abcdef1234567890abcdef12345678"
      displayName={true}
    />,
    <Address
      address="0x1234567890abcdef1234567890abcdef12345678"
      displayName={true}
      avatar={false}
    />,
    <Address
      address="0x1234567890abcdef1234567890abcdef12345678"
      truncate={true}
      displayName={false}
      avatar={true}
    />,
  ])('validates an address element', (value) => {
    expect(is(value, AddressStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Address />,
    // @ts-expect-error - Invalid props.
    <Address>
      <Text>foo</Text>
    </Address>,
    <Address address="0x1234" />,
    <Address address="a:b:0x1234" />,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
    <Address
      address="0x1234567890abcdef1234567890abcdef12345678"
      // @ts-expect-error - Invalid props.
      truncate="wrong-prop"
    />,
    <Address
      address="0x1234567890abcdef1234567890abcdef12345678"
      // @ts-expect-error - Invalid props.
      displayName="false"
    />,
    <Address
      address="0x1234567890abcdef1234567890abcdef12345678"
      // @ts-expect-error - Invalid props.
      avatar="wrong-prop"
    />,
  ])('does not validate "%p"', (value) => {
    expect(is(value, AddressStruct)).toBe(false);
  });
});

describe('BoxStruct', () => {
  it.each([
    <Box>
      <Text>foo</Text>
    </Box>,
    <Box>
      <Text>foo</Text>
      <Text>bar</Text>
    </Box>,
    <Box>
      <Field label="foo">
        <Input name="foo" />
      </Field>
    </Box>,
    <Box>
      <Text>foo</Text>
      <Row label="label">
        <Image src="<svg />" alt="alt" />
      </Row>
    </Box>,
    <Box direction="horizontal" alignment="space-between">
      <Text>foo</Text>
      <Row label="label">
        <Image src="<svg />" alt="alt" />
      </Row>
    </Box>,
    <Box direction="horizontal">
      <Text>foo</Text>
      <Row label="label">
        <Image src="<svg />" alt="alt" />
      </Row>
    </Box>,
    <Box>
      <Text>Foo</Text>
      {[1, 2, 3, 4, 5].map((value) => (
        <Text>{value.toString()}</Text>
      ))}
    </Box>,
  ])('validates a box element', (value) => {
    expect(is(value, BoxStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    <Text>foo</Text>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
    // @ts-expect-error - Invalid props.
    <Box direction="foo">
      <Text>foo</Text>
      <Row label="label">
        <Image src="<svg />" alt="alt" />
      </Row>
    </Box>,
    // @ts-expect-error - Invalid props.
    <Box direction="vertical" alignment="foo">
      <Text>foo</Text>
      <Row label="label">
        <Image src="<svg />" alt="alt" />
      </Row>
    </Box>,
    <Box>
      <Value extra="foo" value="bar" />
    </Box>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, BoxStruct)).toBe(false);
  });
});

describe('FooterStruct', () => {
  it.each([
    <Footer>
      <Button name="confirm">Confirm</Button>
    </Footer>,
    <Footer>
      <Button name="cancel">Cancel</Button>
      <Button name="confirm">Confirm</Button>
    </Footer>,
    <Footer>
      <Button name="cancel">Cancel {true && 'foo'}</Button>
    </Footer>,
    <Footer requireScroll>
      <Button name="accept">Accept</Button>
    </Footer>,
  ])('validates a footer element', (value) => {
    expect(is(value, FooterStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Footer />,
    <Footer>
      <Text>foo</Text>
    </Footer>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
    <Footer>
      <Button name="confirm">
        <Icon name="warning" />
      </Button>
    </Footer>,
    <Footer>
      <Button name="cancel">
        <Image src="<svg />" />
      </Button>
      <Button name="confirm">
        <Image src="<svg />" />
      </Button>
    </Footer>,
    <Footer>
      <Button name="confirm">
        <Icon name="warning" />
        <Icon name="warning" />
      </Button>
    </Footer>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, FooterStruct)).toBe(false);
  });
});

describe('CardStruct', () => {
  it.each([
    <Card
      image="<svg />"
      title="Title"
      description="Description"
      value="$1200"
      extra="0.12 ETH"
    />,
    <Card
      image="<svg />"
      title={
        <Address
          address="0x1234567890123456789012345678901234567890"
          displayName
          avatar={false}
        />
      }
      description="Description"
      value="$1200"
      extra="0.12 ETH"
    />,
  ])('validates a card element', (value) => {
    expect(is(value, CardStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Card />,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, CardStruct)).toBe(false);
  });
});

describe('ContainerStruct', () => {
  it.each([
    <Container>
      <Box>
        <Text>Hello world!</Text>
      </Box>
    </Container>,
    <Container>
      <Box>
        <Text>Hello world!</Text>
      </Box>
      <Footer>
        <Button name="confirm">Confirm</Button>
      </Footer>
    </Container>,
    <Container>
      <Text>Hello world!</Text>
    </Container>,
    <Container backgroundColor="default">
      <Text>Hello world!</Text>
    </Container>,
    <Container backgroundColor="alternative">
      <Text>Hello world!</Text>
    </Container>,
    <Container>
      <Text>Hello world!</Text>
      <Footer>
        <Button name="confirm">Confirm</Button>
      </Footer>
    </Container>,
  ])('validates a container element', (value) => {
    expect(is(value, ContainerStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Container />,
    <Container>
      <Box>
        <Text>Hello world!</Text>
      </Box>
      <Footer>
        <Text>foo</Text>
      </Footer>
    </Container>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, ContainerStruct)).toBe(false);
  });
});

describe('CheckboxStruct', () => {
  it.each([
    <Checkbox name="foo" />,
    <Checkbox name="foo" checked={true} />,
    <Checkbox name="foo" checked={true} label="Foo" variant="toggle" />,
    <Checkbox name="foo" checked={true} disabled={true} label="Foo" />,
  ])('validates a dropdown element', (value) => {
    expect(is(value, CheckboxStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Spinner>foo</Spinner>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, CheckboxStruct)).toBe(false);
  });
});

describe('CopyableStruct', () => {
  it.each([
    <Copyable value="foo" />,
    <Copyable value="bar" sensitive={true} />,
  ])('validates a copyable element', (value) => {
    expect(is(value, CopyableStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Copyable />,
    // @ts-expect-error - Invalid props.
    <Copyable>foo</Copyable>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, CopyableStruct)).toBe(false);
  });
});

describe('DividerStruct', () => {
  it.each([<Divider />])('validates a divider element', (value) => {
    expect(is(value, DividerStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Divider>foo</Divider>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, DividerStruct)).toBe(false);
  });
});

describe('DropdownStruct', () => {
  it.each([
    <Dropdown name="foo">
      <Option value="option1">Option 1</Option>
      <Option value="option2">Option 2</Option>
    </Dropdown>,
    <Dropdown name="foo" disabled={true}>
      <Option value="option1">Option 1</Option>
      <Option value="option2">Option 2</Option>
    </Dropdown>,
    <Dropdown name="foo">
      <Option value="option1">Option 1</Option>
      <Option value="option2" disabled={true}>
        Option 2
      </Option>
    </Dropdown>,
  ])('validates a dropdown element', (value) => {
    expect(is(value, DropdownStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Spinner>foo</Spinner>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, DropdownStruct)).toBe(false);
  });
});

describe('RadioGroupStruct', () => {
  it.each([
    <RadioGroup name="foo">
      <Radio value="option1">Option 1</Radio>
      <Radio value="option2">Option 2</Radio>
    </RadioGroup>,
    <RadioGroup name="foo" disabled={true}>
      <Radio value="option1">Option 1</Radio>
      <Radio value="option2" disabled={true}>
        Option 2
      </Radio>
    </RadioGroup>,
  ])('validates a radio group element', (value) => {
    expect(is(value, RadioGroupStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Spinner>foo</Spinner>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, RadioGroupStruct)).toBe(false);
  });
});

describe('FileInputStruct', () => {
  it.each([
    <FileInput name="foo" />,
    <FileInput name="foo" accept={['image/*']} />,
    <FileInput name="foo" compact />,
    <FileInput name="foo" disabled={true} compact />,
  ])('validates a file input element', (value) => {
    expect(is(value, FileInputStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <FileInput />,
    // @ts-expect-error - Invalid props.
    <FileInput name={42} />,
    // @ts-expect-error - Invalid props.
    <FileInput name="foo" accept="image/*" />,
    // @ts-expect-error - Invalid props.
    <FileInput name="foo" compact="true" />,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="src" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, FileInputStruct)).toBe(false);
  });
});

describe('SelectorStruct', () => {
  it.each([
    <Selector name="foo" title="Title">
      <SelectorOption value="option1">
        <Card title="Foo" value="$1" />
      </SelectorOption>
      <SelectorOption value="option2">
        <Card title="bar" value="$1" />
      </SelectorOption>
    </Selector>,
    <Selector name="foo" title="Title" disabled={true}>
      <SelectorOption value="option1">
        <Card title="Foo" value="$1" />
      </SelectorOption>
    </Selector>,
    <Selector name="foo" title="Title">
      <SelectorOption value="option1" disabled={true}>
        <Card title="Foo" value="$1" />
      </SelectorOption>
    </Selector>,
  ])('validates a selector element', (value) => {
    expect(is(value, SelectorStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Selector>foo</Selector>,
    // @ts-expect-error - Invalid props.
    <Selector>
      <SelectorOption value="foo">
        <Card title="Foo" value="$1" />
      </SelectorOption>
    </Selector>,
    // @ts-expect-error - Invalid props.
    <Selector title="Choose an option">
      <SelectorOption value="foo">
        <Card title="Foo" value="$1" />
      </SelectorOption>
    </Selector>,
    // @ts-expect-error - Invalid props.
    <Selector name="foo">
      <SelectorOption value="foo">
        <Card title="Foo" value="$1" />
      </SelectorOption>
    </Selector>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, SelectorStruct)).toBe(false);
  });
});

describe('HeadingStruct', () => {
  it.each([<Heading>Hello</Heading>, <Heading size="lg">Hello</Heading>])(
    'validates a heading element',
    (value) => {
      expect(is(value, HeadingStruct)).toBe(true);
    },
  );

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Heading />,
    <Heading>
      {/* @ts-expect-error - Invalid props. */}
      <Text>foo</Text>
    </Heading>,
    <Box>
      <Text>Hello</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, HeadingStruct)).toBe(false);
  });
});

describe('ImageStruct', () => {
  it.each([
    <Image src="<svg />" alt="alt" />,
    <Image src="<svg />" />,
    <Image src="<svg />" alt="alt" borderRadius="medium" />,
  ])('validates an image element', (value) => {
    expect(is(value, ImageStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Image />,
    // @ts-expect-error - Invalid props.
    <Image src="<svg />" alt={42} />,
    // @ts-expect-error - Invalid props.
    <Image src="<svg />" borderRadius="52px" />,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, ImageStruct)).toBe(false);
  });
});

describe('LinkStruct', () => {
  it.each([
    <Link href="https://example.com">foo</Link>,
    <Link href="metamask://client/">
      <Icon name="arrow-left" size="md" />
    </Link>,
    <Link href="https://example.com">
      <Address address="0x1234567890123456789012345678901234567890" />
    </Link>,
  ])('validates a link element', (value) => {
    expect(is(value, LinkStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Link />,
    // @ts-expect-error - Invalid props.
    <Link href={42}>foo</Link>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
    <Row label="label">
      <Link href="https://example.com">
        <Address address="0x1234567890123456789012345678901234567890" />
      </Link>
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, LinkStruct)).toBe(false);
  });
});

describe('IconStruct', () => {
  it.each([
    <Icon name="warning" />,
    <Icon name="wifi" color="muted" />,
    <Icon name="wifi" size="md" />,
    <Icon name="warning" color="default" size="inherit" />,
  ])('validates an icon element', (value) => {
    expect(is(value, IconStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Icon />,
    // @ts-expect-error - Invalid props.
    <Icon name="bar">foo</Icon>,
    // @ts-expect-error - Invalid props.
    <Icon name="bar" color="foo" />,
    // @ts-expect-error - Invalid props.
    <Icon name="bar" size="foo" />,
    <Box>
      <Icon name="wifi" />
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, IconStruct)).toBe(false);
  });
});

describe('TextStruct', () => {
  it.each([
    <Text>foo</Text>,
    <Text alignment="end">foo</Text>,
    <Text>
      Hello, <Bold>world</Bold>
    </Text>,
    <Text size="sm">foo</Text>,
    <Text fontWeight="medium">foo</Text>,
  ])('validates a text element', (value) => {
    expect(is(value, TextStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Text />,
    // @ts-expect-error - Invalid props.
    <Text foo="bar">foo</Text>,
    // @ts-expect-error - Invalid props.
    <Text fontWeight="bar">foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, TextStruct)).toBe(false);
  });
});

describe('TooltipStruct', () => {
  it.each([
    <Tooltip content="foo">
      <Text>bar</Text>
    </Tooltip>,
    <Tooltip content={<Text>foo</Text>}>
      <Bold>bar</Bold>
    </Tooltip>,
  ])(`validates a tooltip element`, (value) => {
    expect(is(value, TooltipStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Tooltip />,
    // @ts-expect-error - Invalid props.
    <Tooltip foo="bar">foo</Tooltip>,
    <Tooltip content={<Copyable value="bar" />}>
      <Text>foo</Text>
    </Tooltip>,
    <Box>
      <Tooltip content={'foo'}>
        <Text>foo</Text>
      </Tooltip>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, TooltipStruct)).toBe(false);
  });
});

describe('RowStruct', () => {
  it.each([
    <Row label="label">
      <Text>foo</Text>
    </Row>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
    <Row label="label" variant="default">
      <Address address="0x1234567890abcdef1234567890abcdef12345678" />
    </Row>,
    <Row label="label" variant="default">
      <Value extra="foo" value="bar" />
    </Row>,
    <Row label="label" variant="default" tooltip="This is a tooltip.">
      <Value extra="foo" value="bar" />
    </Row>,
  ])('validates a row element', (value) => {
    expect(is(value, RowStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Row />,
    <Row label="label">
      <Bold>foo</Bold>
    </Row>,
    // @ts-expect-error - Invalid props.
    <Row label="label" variant="foo">
      <Text>foo</Text>
    </Row>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, RowStruct)).toBe(false);
  });
});

describe('SpinnerStruct', () => {
  it.each([<Spinner />])('validates a spinner element', (value) => {
    expect(is(value, SpinnerStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Spinner>foo</Spinner>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, SpinnerStruct)).toBe(false);
  });
});

describe('ValueStruct', () => {
  it.each([
    <Value extra="foo" value="bar" />,
    <Value
      value={<Text color="error">0.05 ETH</Text>}
      extra={<Text color="error">$200</Text>}
    />,
  ])('validates a value element', (value) => {
    expect(is(value, ValueStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Value />,
    // @ts-expect-error - Invalid props.
    <Value left="foo" />,
    <Value
      value={<Heading>0.05 ETH</Heading>}
      extra={<Heading>$200</Heading>}
    />,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, ValueStruct)).toBe(false);
  });
});

describe('SectionStruct', () => {
  it.each([
    <Section>
      <Box>
        <Text>Hello world!</Text>
      </Box>
    </Section>,
    <Section>
      <Row label="From">
        <Address address="0x1234567890123456789012345678901234567890" />
      </Row>
      <Row
        label="To"
        variant="warning"
        tooltip="This address has been deemed dangerous."
      >
        <Address address="0x0000000000000000000000000000000000000000" />
      </Row>
    </Section>,
    <Section direction="horizontal" alignment="space-between">
      <Text>foo</Text>
      <Row label="label">
        <Image src="<svg />" alt="alt" />
      </Row>
    </Section>,
    <Section direction="horizontal">
      <Text>foo</Text>
      <Row label="label">
        <Image src="<svg />" alt="alt" />
      </Row>
    </Section>,
  ])('validates a section element', (value) => {
    expect(is(value, SectionStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Section />,
    // @ts-expect-error - Invalid props.
    <Section></Section>,
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
    // @ts-expect-error - Invalid props.
    <Section direction="diagonal">
      <Box>
        <Text>Hello world!</Text>
      </Box>
    </Section>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, SectionStruct)).toBe(false);
  });
});

describe('isJSXElement', () => {
  it.each([
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('returns true for a JSX element', (value) => {
    expect(isJSXElement(value)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    {
      type: 'text',
      props: {
        children: 'foo',
      },
    },
    {
      type: 'box',
      props: {
        children: {
          type: 'text',
          props: {
            children: 'foo',
          },
        },
      },
    },
    {
      type: 'row',
      key: null,
    },
  ])('returns false for "%p"', (value) => {
    expect(isJSXElement(value)).toBe(false);
  });
});

describe('isJSXElementUnsafe', () => {
  it.each([
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('returns true for a JSX element', (value) => {
    expect(isJSXElementUnsafe(value)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    {
      type: 'text',
      props: {
        children: 'foo',
      },
    },
    {
      type: 'box',
      props: {
        children: {
          type: 'text',
          props: {
            children: 'foo',
          },
        },
      },
    },
    {
      type: 'row',
      key: null,
    },
  ])('returns false for "%p"', (value) => {
    expect(isJSXElement(value)).toBe(false);
  });

  it('does not validate the props of a JSX element', () => {
    expect(
      isJSXElementUnsafe(
        // @ts-expect-error - Invalid props.
        <Text foo="bar">
          <Text>Invalid</Text>
        </Text>,
      ),
    ).toBe(true);
  });
});

describe('assertJSXElement', () => {
  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    {
      type: 'text',
      props: {
        children: 'foo',
      },
    },
    {
      type: 'box',
      props: {
        children: {
          type: 'text',
          props: {
            children: 'foo',
          },
        },
      },
    },
    {
      type: 'row',
      key: null,
    },
  ])('throws an error for "%p"', (element) => {
    expect(() => {
      assertJSXElement(element);
    }).toThrow(
      /Expected a JSX element, but received .+\. Please refer to the documentation for the supported JSX elements and their props\./u,
    );
  });

  it.each([
    <Text>foo</Text>,
    <Box>
      <Text>foo</Text>
    </Box>,
    <Row label="label">
      <Image src="<svg />" alt="alt" />
    </Row>,
  ])('does not throw an error for a JSX element', (value) => {
    expect(() => {
      assertJSXElement(value);
    }).not.toThrow();
  });
});

describe('BannerStruct', () => {
  it.each([
    <Banner title="foo" severity="info">
      <Text>bar</Text>
    </Banner>,
  ])(`validates a banner element`, (value) => {
    expect(is(value, BannerStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Banner />,
    // @ts-expect-error - Invalid props.
    <Banner foo="bar">foo</Banner>,
    // @ts-expect-error - Invalid props.
    <Banner title={<Copyable value="bar" />} severity="info">
      <Text>foo</Text>
    </Banner>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, BannerStruct)).toBe(false);
  });
});

describe('SkeletonStruct', () => {
  it.each([
    <Skeleton />,
    <Skeleton width={320} height={32} />,
    <Skeleton width="30%" height="30%" />,
    <Skeleton width={32} height="30%" />,
    <Skeleton width="30%" height={32} />,
    <Skeleton width="30%" height={32} borderRadius="full" />,
    <Skeleton width={32} height="30%" borderRadius="medium" />,
  ])(`validates a Skeleton element`, (value) => {
    expect(is(value, SkeletonStruct)).toBe(true);
  });

  it.each([
    'foo',
    42,
    null,
    undefined,
    {},
    [],
    // @ts-expect-error - Invalid props.
    <Skeleton foo="bar">foo</Skeleton>,
    // @ts-expect-error - Invalid props.
    <Skeleton title={<Copyable value="bar" />} severity="info">
      <Text>foo</Text>
    </Skeleton>,
  ])('does not validate "%p"', (value) => {
    expect(is(value, SkeletonStruct)).toBe(false);
  });
});
