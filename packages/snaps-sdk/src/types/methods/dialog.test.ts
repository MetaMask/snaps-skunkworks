import { expectTypeOf } from 'expect-type';

import type {
  ConfirmationDialog,
  PromptDialog,
  AlertDialog,
  DialogParams,
} from './dialog';
import { DialogType } from './dialog';
import type { text } from '../../ui';

describe('DialogType', () => {
  it('has the correct values', () => {
    expect(Object.values(DialogType)).toHaveLength(3);
    expect(DialogType.Alert).toBe('alert');
    expect(DialogType.Confirmation).toBe('confirmation');
    expect(DialogType.Prompt).toBe('prompt');
  });
});

describe('AlertDialog', () => {
  it('accepts the type as enum', () => {
    expectTypeOf<{
      type: DialogType.Alert;
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<AlertDialog>();
  });

  it('accepts the type as string', () => {
    expectTypeOf<{
      type: 'alert';
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<AlertDialog>();
  });

  it('does not accept other types', () => {
    expectTypeOf<{
      type: DialogType.Confirmation;
      content: ReturnType<typeof text>;
    }>().not.toMatchTypeOf<AlertDialog>();

    expectTypeOf<{
      type: 'confirmation';
      content: ReturnType<typeof text>;
    }>().not.toMatchTypeOf<AlertDialog>();
  });
});

describe('ConfirmationDialog', () => {
  it('accepts the type as enum', () => {
    expectTypeOf<{
      type: DialogType.Confirmation;
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<ConfirmationDialog>();
  });

  it('accepts the type as string', () => {
    expectTypeOf<{
      type: 'confirmation';
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<ConfirmationDialog>();
  });

  it('does not accept other types', () => {
    expectTypeOf<{
      type: DialogType.Alert;
      content: ReturnType<typeof text>;
    }>().not.toMatchTypeOf<ConfirmationDialog>();

    expectTypeOf<{
      type: 'alert';
      content: ReturnType<typeof text>;
    }>().not.toMatchTypeOf<ConfirmationDialog>();
  });
});

describe('PromptDialog', () => {
  it('accepts the type as enum', () => {
    expectTypeOf<{
      type: DialogType.Prompt;
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<PromptDialog>();
  });

  it('accepts the type as string', () => {
    expectTypeOf<{
      type: 'prompt';
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<PromptDialog>();
  });

  it('does not accept other types', () => {
    expectTypeOf<{
      type: DialogType.Alert;
      content: ReturnType<typeof text>;
    }>().not.toMatchTypeOf<PromptDialog>();

    expectTypeOf<{
      type: 'alert';
      content: ReturnType<typeof text>;
    }>().not.toMatchTypeOf<PromptDialog>();
  });
});

describe('DialogParams', () => {
  it('accepts the type as enum', () => {
    expectTypeOf<{
      type: DialogType.Alert;
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<DialogParams>();

    expectTypeOf<{
      type: DialogType.Confirmation;
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<DialogParams>();

    expectTypeOf<{
      type: DialogType.Prompt;
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<DialogParams>();
  });

  it('accepts the type as string', () => {
    expectTypeOf<{
      type: 'alert';
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<DialogParams>();

    expectTypeOf<{
      type: 'confirmation';
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<DialogParams>();

    expectTypeOf<{
      type: 'prompt';
      content: ReturnType<typeof text>;
    }>().toMatchTypeOf<DialogParams>();
  });
});
