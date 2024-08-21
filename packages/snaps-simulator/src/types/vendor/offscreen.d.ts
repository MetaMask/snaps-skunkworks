// eslint-disable-next-line import-x/unambiguous
declare namespace chrome.offscreen {
  export type Reason =
    | 'TESTING'
    | 'AUDIO_PLAYBACK'
    | 'IFRAME_SCRIPTING'
    | 'DOM_SCRAPING'
    | 'BLOBS'
    | 'DOM_PARSER'
    | 'USER_MEDIA'
    | 'DISPLAY_MEDIA'
    | 'WEB_RTC'
    | 'CLIPBOARD';

  export type CreateParameters = {
    justification: string;
    reasons: Reason[];
    url: string;
  };

  export function hasDocument(): Promise<boolean>;

  export function createDocument(
    parameters: CreateParameters,
    callback?: () => void,
  ): Promise<void>;

  export function closeDocument(callback?: () => void): Promise<void>;
}
