// Entry point for Cloudflare Worker deployment
import app from './app';
import { Editor } from './cloudflare';

export default {
  fetch: app.fetch,
};

export { Editor };
