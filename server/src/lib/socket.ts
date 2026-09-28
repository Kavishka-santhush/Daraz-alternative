import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import logger from '../config/logger';
import { AccessTokenPayload } from '../middleware/auth';

let io: Server | undefined;

const USER_ROOM = (id: string) => `user:${id}`;
const ROLE_ROOM = (role: string) => `role:${role}`;
const SHOP_ROOM = (shopId: string) => `shop:${shopId}`;

function authenticate(socket: Socket): AccessTokenPayload | null {
  const raw =
    (socket.handshake.auth?.token as string) ||
    (socket.handshake.headers.authorization || '').replace('Bearer ', '');
  if (!raw) return null;
  try {
    return jwt.verify(raw, env.jwt.accessSecret) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.webUrl, credentials: true },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    const user = authenticate(socket);
    if (user) (socket.data as any).user = user;
    next(); // allow anonymous connections for live-chat guests
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket.data as any).user as AccessTokenPayload | undefined;
    if (user) {
      socket.join(USER_ROOM(user.id));
      socket.join(ROLE_ROOM(user.role));
      logger.debug(`socket connected user=${user.id}`);
    }

    socket.on('shop:subscribe', (shopId: string) => {
      if (user) socket.join(SHOP_ROOM(shopId));
    });
    socket.on('shop:unsubscribe', (shopId: string) => socket.leave(SHOP_ROOM(shopId)));

    socket.on('chat:join', (roomId: string) => socket.join(`chat:${roomId}`));
    socket.on('chat:message', (payload: { roomId: string; from: string; text: string }) => {
      socket.to(`chat:${payload.roomId}`).emit('chat:message', payload);
    });

    socket.on('disconnect', () => logger.debug(`socket disconnected ${socket.id}`));
  });

  return io;
}

export function getIo(): Server | undefined {
  return io;
}

export const emitToUser = (userId: string, event: string, data: unknown) => io?.to(USER_ROOM(userId)).emit(event, data);
export const emitToRole = (role: string, event: string, data: unknown) => io?.to(ROLE_ROOM(role)).emit(event, data);
export const emitToShop = (shopId: string, event: string, data: unknown) => io?.to(SHOP_ROOM(shopId)).emit(event, data);
export const emitBroadcast = (event: string, data: unknown) => io?.emit(event, data);
