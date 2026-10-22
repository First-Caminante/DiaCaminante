import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

const messageChannelPolyfill = `
if (typeof globalThis.MessageChannel === "undefined") {
  class P {
    constructor() { this.onmessage = null; }
    postMessage(d) {
      queueMicrotask(() => { if (typeof this.onmessage === "function") this.onmessage({ data: d }); });
    }
    close() {}
  }
  class MC {
    constructor() {
      this.port1 = new P();
      this.port2 = new P();
      this.port1.postMessage = (d) => queueMicrotask(() => { if (typeof this.port2.onmessage === "function") this.port2.onmessage({ data: d }); });
      this.port2.postMessage = (d) => queueMicrotask(() => { if (typeof this.port1.onmessage === "function") this.port1.onmessage({ data: d }); });
    }
  }
  globalThis.MessageChannel = MC;
}
`;

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'compile',
  }),
  integrations: [react(), tailwind()],
  vite: {
    define: {
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || 'https://conedgbqbwoazfwspstg.supabase.co'),
      'process.env.SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
    },
    build: {
      rollupOptions: {
        output: {
          banner: messageChannelPolyfill,
        },
      },
    },
  },
});
