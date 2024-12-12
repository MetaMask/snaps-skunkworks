import type { ExecutionServiceArgs } from '../AbstractExecutionService';
import { ProxyExecutionService } from '../proxy/ProxyExecutionService';
import type { WebViewInterface } from './WebViewMessageStream';
import { WebViewMessageStream } from './WebViewMessageStream';

export type WebViewExecutionServiceArgs = ExecutionServiceArgs & {
  getWebView: () => Promise<WebViewInterface>;
  btoa?: (data: string) => string;
};

export class WebViewExecutionService extends ProxyExecutionService {
  #getWebView;

  constructor({
    messenger,
    setupSnapProvider,
    getWebView,
    btoa,
  }: WebViewExecutionServiceArgs) {
    super({
      messenger,
      setupSnapProvider,
      stream: new WebViewMessageStream({
        name: 'parent',
        target: 'child',
        getWebView,
        btoa,
      }),
    });
    this.#getWebView = getWebView;
  }

  /**
   * Create a new stream for the specified job. This wraps the runtime stream
   * in a stream specific to the job.
   *
   * @param jobId - The job ID.
   * @returns An object with the worker ID and stream.
   */
  protected async initEnvStream(jobId: string) {
    // Ensure that the WebView has been loaded before we proceed.
    await this.#ensureWebViewLoaded();

    return super.initEnvStream(jobId);
  }

  /**
   * Ensure that the WebView has been loaded by awaiting the getWebView promise.
   */
  async #ensureWebViewLoaded() {
    await this.#getWebView();
  }
}
