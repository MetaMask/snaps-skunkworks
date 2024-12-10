import { JsonRpcEngine } from '@metamask/json-rpc-engine';
import type {
  ScheduleBackgroundEventParams,
  ScheduleBackgroundEventResult,
} from '@metamask/snaps-sdk';
import type { JsonRpcRequest, PendingJsonRpcResponse } from '@metamask/utils';

import { scheduleBackgroundEventHandler } from './scheduleBackgroundEvent';

describe('snap_scheduleBackgroundEvent', () => {
  describe('scheduleBackgroundEventHandler', () => {
    it('has the expected shape', () => {
      expect(scheduleBackgroundEventHandler).toMatchObject({
        methodNames: ['snap_scheduleBackgroundEvent'],
        implementation: expect.any(Function),
        hookNames: {
          scheduleBackgroundEvent: true,
        },
      });
    });
  });

  describe('implementation', () => {
    it('returns an id after calling the `scheduleBackgroundEvent` hook', async () => {
      const { implementation } = scheduleBackgroundEventHandler;

      const scheduleBackgroundEvent = jest.fn().mockImplementation(() => 'foo');

      const hooks = {
        scheduleBackgroundEvent,
      };

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<ScheduleBackgroundEventParams>,
          response as PendingJsonRpcResponse<ScheduleBackgroundEventResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_scheduleBackgroundEvent',
        params: {
          date: '2022-01-01T01:00',
          request: {
            method: 'handleExport',
            params: ['p1'],
          },
        },
      });

      expect(response).toStrictEqual({ jsonrpc: '2.0', id: 1, result: 'foo' });
    });

    it('schedules a background event', async () => {
      const { implementation } = scheduleBackgroundEventHandler;

      const scheduleBackgroundEvent = jest.fn();

      const hooks = {
        scheduleBackgroundEvent,
      };

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<ScheduleBackgroundEventParams>,
          response as PendingJsonRpcResponse<ScheduleBackgroundEventResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_scheduleBackgroundEvent',
        params: {
          date: '2022-01-01T01:00',
          request: {
            method: 'handleExport',
            params: ['p1'],
          },
        },
      });

      expect(scheduleBackgroundEvent).toHaveBeenCalledWith({
        scheduledAt: expect.any(String),
        date: '2022-01-01T01:00',
        request: {
          method: 'handleExport',
          params: ['p1'],
        },
      });
    });

    it('throws on invalid params', async () => {
      const { implementation } = scheduleBackgroundEventHandler;

      const scheduleBackgroundEvent = jest.fn();

      const hooks = {
        scheduleBackgroundEvent,
      };

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<ScheduleBackgroundEventParams>,
          response as PendingJsonRpcResponse<ScheduleBackgroundEventResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_scheduleBackgroundEvent',
        params: {
          date: 'foobar',
          request: {
            method: 'handleExport',
            params: ['p1'],
          },
        },
      });

      expect(response).toStrictEqual({
        error: {
          code: -32602,
          message:
            'Invalid params: At path: date -- Not a valid ISO8601 string.',
          stack: expect.any(String),
        },
        id: 1,
        jsonrpc: '2.0',
      });
    });
  });
});
