import { Injectable } from '@nestjs/common';
import { CaroService } from './caro.service';
import { WsException } from '@nestjs/websockets';

interface PlayerSession {
  userId: number;
  socketId: string;
  joinedAt: number;
  matchId?: number;
}

@Injectable()
export class MatchmakerService {
  private queue: number[] = []; // chỉ lưu userId
  private userSessions = new Map<number, PlayerSession>(); // {userId -> session}
  private socketToUser = new Map<string, number>(); // {socketId -> userId}
  private queueLock = false; // tránh race condition

  constructor(private readonly caroService: CaroService) {}

  /** Kiểm tra user có đang chờ match */
  isInQueue(userId: number) {
    return this.queue.includes(userId);
  }

  /** Thêm user vào hàng chờ */
  async enqueue(userId: number) {
    if (!this.isInQueue(userId)) {
      this.queue.push(userId);
    }

    // Chống race condition — chỉ một lần ghép cặp chạy tại một thời điểm
    if (this.queueLock) return null;
    this.queueLock = true;

    let matchId: number | null = null;
    try {
      while (this.queue.length >= 2) {
        const a = this.queue.shift()!;
        const b = this.queue.shift()!;
        const caro = await this.caroService.createGame([a, b]);
        this.caroService.setCache(caro);
        matchId = caro.id;
      }
    } finally {
      this.queueLock = false;
    }

    return matchId;
  }

  /** Xóa user khỏi queue và mapping */
  remove(userId: number) {
    this.queue = this.queue.filter((u) => u !== userId);
    const session = this.userSessions.get(userId);
    if (session) {
      this.socketToUser.delete(session.socketId);
    }
    this.userSessions.delete(userId);
  }

  /** Gán socketId cho userId (có xử lý reconnect) */
  setSocketId(userId: number, socketId: string) {
    const oldSession = this.userSessions.get(userId);
    if (oldSession && oldSession.socketId !== socketId) {
      // Xóa socket cũ khỏi map
      this.socketToUser.delete(oldSession.socketId);
    }

    const oldUserId = this.socketToUser.get(socketId);
    if (oldUserId && oldUserId !== userId) {
      // Nếu socketId đang dùng cho user khác → bỏ mapping cũ (nhưng không xóa khỏi queue)
      const oldUserSession = this.userSessions.get(oldUserId);
      if (oldUserSession) {
        this.socketToUser.delete(oldUserSession.socketId);
        this.userSessions.delete(oldUserId);
      }
    }

    const session: PlayerSession = {
      userId,
      socketId,
      joinedAt: Date.now(),
    };
    this.userSessions.set(userId, session);
    this.socketToUser.set(socketId, userId);
  }

  /** Lấy socketId từ userId */
  getSocketId(userId: number) {
    const session = this.userSessions.get(userId);
    if (!session) {
      throw new WsException('Socket not found for user');
    }
    return session.socketId;
  }

  /** Lấy userId từ socketId */
  getUserId(socketId: string) {
    const userId = this.socketToUser.get(socketId);
    if (!userId) {
      throw new WsException('User not found for socket');
    }
    return userId;
  }

  setMatch(userId: number, matchId: number) {
    const session = this.userSessions.get(userId);
    if (!session) {
      throw new WsException('Socket not found for user');
    }

    this.userSessions.set(userId, { ...session, matchId });
  }

  getActiveMatch(userId: number) {
    return this.userSessions.get(userId)?.matchId;
  }
}
