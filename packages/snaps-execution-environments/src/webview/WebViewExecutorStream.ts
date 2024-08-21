import type { PostMessageEvent } from '@metamask/post-message-stream';
import { BasePostMessageStream } from '@metamask/post-message-stream';
import { isValidStreamMessage } from '@metamask/post-message-stream/dist/utils';
import { base64ToBytes, bytesToString } from '@metamask/utils';

type WebViewExecutorStreamArgs = {
  name: string;
  target: string;
  targetWindow: Window['ReactNativeWebView'];
};

export class WebViewExecutorStream extends BasePostMessageStream {
  readonly #name;

  readonly #target;

  readonly #targetWindow;

  /**
   * A special post-message-stream to be used by the WebView executor.
   *
   * This stream is different in a few ways:
   * - It expects data to be base64 encoded
   * - It stringifies the data it posts
   * - It does less validation of origins
   *
   * @param args - Options bag.
   * @param args.name - The name of the stream. Used to differentiate between
   * multiple streams sharing the same window object. child:WebView
   * @param args.target - The name of the stream to exchange messages with. parent:rnside
   * @param args.targetWindow - The window object of the target stream.
   */

  constructor({ name, target, targetWindow }: WebViewExecutorStreamArgs) {
    super();

    this.#name = name;
    this.#target = target;
    this.#targetWindow = targetWindow;

    this._onMessage = this._onMessage.bind(this);

    // This method is already bound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    window.addEventListener('message', this._onMessage as any, false);

    this._handshake();
  }

  /**
   * Webview needs to receive strings only on postMessage. That's the main difference between this and the original window post message stream.
   * Reference: https://github.com/react-native-webview/react-native-webview/blob/master/docs/Guide.md?plain=1#L471
   */

  protected _postMessage(data: unknown): void {
    this.#targetWindow.postMessage(
      JSON.stringify({
        target: this.#target,
        data,
      }),
    );
  }

  private _onMessage(event: PostMessageEvent): void {
    if (typeof event.data !== 'string') {
      return;
    }

    const bytes = base64ToBytes(event.data);
    const message = JSON.parse(bytesToString(bytes));

    // Notice that we don't check targetWindow or targetOrigin here.
    // This doesn't seem possible to do in RN.
    if (!isValidStreamMessage(message) || message.target !== this.#name) {
      return;
    }

    this._onData(message.data);
  }

  _destroy() {
    // This method is already bound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    window.removeEventListener('message', this._onMessage as any, false);
  }
}
