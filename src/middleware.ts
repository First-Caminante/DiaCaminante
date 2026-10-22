import { defineMiddleware } from 'astro:middleware';

if (typeof globalThis.MessageChannel === 'undefined') {
  class Port {
    onmessage: ((e: MessageEvent) => void) | null = null;
    postMessage(data: any) {
      queueMicrotask(() => {
        if (typeof this.onmessage === 'function') {
          this.onmessage(new MessageEvent('message', { data }));
        }
      });
    }
    close() {}
  }

  class MessageChannelPolyfill {
    port1: Port;
    port2: Port;
    constructor() {
      this.port1 = new Port();
      this.port2 = new Port();
      this.port1.postMessage = (data: any) => {
        queueMicrotask(() => {
          if (typeof this.port2.onmessage === 'function') {
            this.port2.onmessage(new MessageEvent('message', { data }));
          }
        });
      };
      this.port2.postMessage = (data: any) => {
        queueMicrotask(() => {
          if (typeof this.port1.onmessage === 'function') {
            this.port1.onmessage(new MessageEvent('message', { data }));
          }
        });
      };
    }
  }

  (globalThis as any).MessageChannel = MessageChannelPolyfill;
}

export const onRequest = defineMiddleware(async (_context, next) => {
  return next();
});
