export interface VolcanoCredential {
  /** New console: a single API key, sent as the x-api-key header. */
  apiKey?: string;
  /** Legacy console: app id, sent inside the request body. */
  appId?: string;
  /** Legacy console: access token, sent as an Authorization header. */
  accessToken?: string;
  /** Voice cluster, defaults to volcano_tts. */
  cluster?: string;
}

export interface VolcanoTtsRequest {
  headers: Record<string, string>;
  body: string;
}

const DEFAULT_CLUSTER = 'volcano_tts';
const DEFAULT_SPEAKER = 'BV001';

/**
 * Build the request for the Volcengine (Doubao) TTS HTTP interface.
 *
 * The interface accepts two credential styles:
 * - new console: a single API key in the `x-api-key` header, with only the
 *   cluster inside `app`;
 * - legacy console: app id plus access token, where the app id and token go
 *   into `app` and the access token is repeated in the Authorization header.
 *
 * The API key takes precedence when both are configured.
 */
export function buildVolcanoTtsRequest(options: {
  credential: VolcanoCredential | undefined;
  text: string;
  speaker?: string;
  uid?: string;
  requestId: string;
}): VolcanoTtsRequest {
  const credential = options.credential ?? {};
  const apiKey = credential.apiKey?.trim() ?? '';
  const accessToken = credential.accessToken?.trim() ?? '';
  const appId = credential.appId?.trim() ?? '';
  const useApiKey = apiKey.length > 0;

  if (!useApiKey && !accessToken) {
    throw new Error('火山引擎配置不完整：请填写 API Key，或旧版 App ID + Access Token');
  }

  const cluster = credential.cluster?.trim() || DEFAULT_CLUSTER;
  const app: Record<string, string> = { cluster };
  if (!useApiKey) {
    if (appId) app.appid = appId;
    app.token = accessToken;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useApiKey) {
    headers['x-api-key'] = apiKey;
  } else {
    headers.Authorization = 'Bearer; ' + accessToken;
  }

  const body = JSON.stringify({
    app,
    user: { uid: options.uid || 'mi-paiai' },
    audio: {
      voice_type: options.speaker?.trim() || DEFAULT_SPEAKER,
      encoding: 'mp3',
      rate: 24000,
    },
    request: {
      reqid: options.requestId,
      text: options.text,
      text_type: 'plain',
      operation: 'query',
    },
  });

  return { headers, body };
}
