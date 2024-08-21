import { WebViewExecutorStream } from './WebViewExecutorStream';
import { executeLockdownEvents } from '../common/lockdown/lockdown-events';
import { executeLockdownMore } from '../common/lockdown/lockdown-more';
import { ProxySnapExecutor } from '../proxy/ProxySnapExecutor';

// Lockdown is already applied in LavaMoat
executeLockdownMore();
executeLockdownEvents();

const parentStream = new WebViewExecutorStream({
  name: 'child', // webview
  target: 'parent', // rnside
  targetWindow: window.ReactNativeWebView,
});

ProxySnapExecutor.initialize(parentStream);
