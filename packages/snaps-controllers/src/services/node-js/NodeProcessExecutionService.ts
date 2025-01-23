import type { BasePostMessageStream } from '@metamask/post-message-stream';
import { ProcessParentMessageStream } from '@metamask/post-message-stream';
import type { ChildProcess } from 'child_process';
import { fork } from 'child_process';

import type { TerminateJobArgs } from '..';
import { AbstractExecutionService } from '..';

export class NodeProcessExecutionService extends AbstractExecutionService<ChildProcess> {
  protected async initEnvStream(): Promise<{
    worker: ChildProcess;
    stream: BasePostMessageStream;
  }> {
    const worker = fork(
      require.resolve(
        '@metamask/snaps-execution-environments/dist/webpack/node-process/bundle.js',
      ),
      {
        stdio: 'pipe',
      },
    );

    // Capturing `stdout` and `stderr` from the worker prevents the worker from
    // writing to them directly, making it easier to capture them Jest.
    worker.stdout?.on('data', (data) => {
      // eslint-disable-next-line no-console
      console.log(data.toString());
    });

    worker.stderr?.on('data', (data) => {
      // eslint-disable-next-line no-console
      console.error(data.toString());
    });

    const stream = new ProcessParentMessageStream({ process: worker });
    return Promise.resolve({ worker, stream });
  }

  protected terminateJob(jobWrapper: TerminateJobArgs<ChildProcess>): void {
    jobWrapper.worker?.kill();
  }
}
