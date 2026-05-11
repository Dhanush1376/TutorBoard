import { Server as HttpServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { container } from '../../core/container.js';
import { setupTeachingSocket } from '../../sockets/teaching.socket.js';
import { childLogger } from '../../core/logger.js';
import { runtimeState } from '../../core/runtimeState.js';

type OriginCallback = (err: Error | null, allow?: boolean) => void;

class SocketLifecycleManager {
  private io: SocketIO | null = null;
  private log = childLogger({ subsystem: 'socket' });

  start(httpServer: HttpServer, isOriginAllowed: (origin: string | undefined, callback: OriginCallback) => void) {
    if (this.io) return this.io;

    this.io = new SocketIO(httpServer, {
      cors: {
        origin: isOriginAllowed as any,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    if (container.has('redis-pub') && container.has('redis-sub')) {
      try {
        const pub = container.resolve<any>('redis-pub');
        const sub = container.resolve<any>('redis-sub');
        this.io.adapter(createAdapter(pub, sub));
        this.log.info('Redis adapter active');
        runtimeState.setCapability({
          name: 'socket',
          mode: 'REAL',
          status: 'healthy',
          ready: true,
          dependencies: ['redis'],
          details: 'Socket.IO Redis adapter active',
        });
      } catch (err) {
        this.log.error('Failed to resolve Redis for socket adapter, falling back to local.');
      }
    } else {
      this.log.info('Single-process socket mode active');
      runtimeState.setCapability({
        name: 'socket',
        mode: 'MOCKED',
        status: 'healthy',
        ready: true,
        details: 'Socket.IO single-process adapter',
      });
    }

    setupTeachingSocket(this.io);
    runtimeState.registerCleanup('socket', () => this.stop());
    return this.io;
  }

  async stop() {
    if (!this.io) return;
    const io = this.io;
    this.io = null;
    await new Promise<void>((resolve) => io.close(() => resolve()));
    this.log.info('Socket.IO closed');
  }

  get server() {
    return this.io;
  }
}

export const socketManager = new SocketLifecycleManager();
