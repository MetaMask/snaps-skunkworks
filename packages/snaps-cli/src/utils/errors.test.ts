import { getErrorMessage, getYargsErrorMessage } from './errors';
import { CommandError } from '../errors';

describe('getYargsErrorMessage', () => {
  it('returns the plain message if the error is undefined', () => {
    expect(getYargsErrorMessage('foo', undefined)).toBe('foo');
  });

  it('returns the error message if the error is not undefined', () => {
    expect(getYargsErrorMessage('foo', 'bar')).toBe('bar');
  });

  it('returns the error message if the error extends `CLIError`', () => {
    const error = new CommandError('foo');
    error.stack = 'bar';

    expect(getYargsErrorMessage('baz', error)).toBe('foo');
  });
});

describe('getErrorMessage', () => {
  it('returns the stack trace if it exists', () => {
    const error = new Error('foo');
    error.stack = 'bar';

    expect(getErrorMessage(error)).toBe('bar');
  });

  it('returns the message if the stack trace does not exist', () => {
    const error = new Error('foo');
    delete error.stack;

    expect(getErrorMessage(error)).toBe('foo');
  });

  it('returns the stringified error if it is not an instance of Error', () => {
    expect(getErrorMessage('foo')).toBe('foo');
  });
});
