import type { PostMessageEvent } from '@metamask/post-message-stream';
import { BasePostMessageStream } from '@metamask/post-message-stream';
import { isValidStreamMessage } from '@metamask/post-message-stream/dist/utils';
import { logError } from '@metamask/snaps-utils';
import { assert, bytesToBase64, stringToBytes } from '@metamask/utils';

export type WebViewInterface = {
  injectJavaScript(js: string): void;
  registerMessageListener(listener: (event: PostMessageEvent) => void): void;
  unregisterMessageListener(listener: (event: PostMessageEvent) => void): void;
};

export type WebViewStreamArgs = {
  name: string;
  target: string;
  getWebView: () => Promise<WebViewInterface>;
  btoa?: (data: string) => string;
};

/**
 * A special postMessage stream used to interface with a WebView.
 */
export class WebViewMessageStream extends BasePostMessageStream {
  #name;

  #target;

  #webView: WebViewInterface | undefined;

  #btoa?: (data: string) => string;

  /**
   * Creates a stream for communicating with other streams inside a WebView.
   *
   * @param args - Options bag.
   * @param args.name - The name of the stream. Used to differentiate between
   * multiple streams sharing the same window object.
   * @param args.target - The name of the stream to exchange messages with.
   * @param args.getWebView - A asynchronous getter for the webview.
   * @param args.btoa - An optional function that encodes a string to base64.
   */
  constructor({ name, target, getWebView, btoa }: WebViewStreamArgs) {
    super();

    this.#name = name;
    this.#target = target;
    this.#btoa = btoa;

    this._onMessage = this._onMessage.bind(this);

    // This is a bit atypical from other post-message streams.
    // We have to wait for the WebView to fully load before we can continue using the stream.
    getWebView()
      .then((webView) => {
        this.#webView = webView;
        // This method is already bound.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        webView.registerMessageListener(this._onMessage);
        this._handshake();
      })
      .catch((error) => {
        logError(error);
      });
  }

  #encodeMessage(json: string): string {
    if (this.#btoa) {
      return this.#btoa(json);
    }

    const bytes = stringToBytes(json);
    return bytesToBase64(bytes);
  }

  protected _postMessage(data: unknown): void {
    assert(this.#webView);
    const json = JSON.stringify({
      target: this.#target,
      data,
    });

    // To prevent XSS, we base64 encode the message before injecting it.
    // This adds significant performance overhead.
    const base64 = this.#encodeMessage(json);
    this.#webView.injectJavaScript(`window.postMessage('${base64}')`);
  }

  private _onMessage(event: PostMessageEvent): void {
    if (typeof event.data !== 'string') {
      return;
    }

    const message = JSON.parse(event.data);

    // Notice that we don't check targetWindow or targetOrigin here.
    // This doesn't seem possible to do in RN.
    if (!isValidStreamMessage(message) || message.target !== this.#name) {
      return;
    }

    this._onData(message.data);
  }

  _destroy() {
    assert(this.#webView);
    // This method is already bound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    this.#webView.unregisterMessageListener(this._onMessage);
  }
}
