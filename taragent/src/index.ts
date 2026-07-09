// Entry point for Cloudflare Worker deployment
import app from './app';

export default {
  fetch: app.fetch,
};
