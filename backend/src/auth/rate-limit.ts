import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';

const newRedis = () =>
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

// Fixed window per key. PTTL is read in the same script so the reply never
// races with expiry. Hits are never dropped on restart or across instances.
const INCREMENT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { hits, redis.call('PTTL', KEYS[1]) }
`;

/**
 * Throttler counters in Redis instead of process memory: they survive
 * restarts and are shared by every backend instance. Fails closed: if Redis
 * is down the request errors out, same as the token denylist.
 */
@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly redis = newRedis();

  async increment(key: string, ttl: number, limit: number) {
    const [totalHits, pttl] = (await this.redis.eval(
      INCREMENT,
      1,
      `throttle:${key}`,
      ttl,
    )) as [number, number];
    return {
      totalHits,
      timeToExpire: Math.max(Math.ceil(pttl / 1000), 0),
      isBlocked: totalHits > limit,
      timeToBlockExpire: 0,
    };
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}

const DAY_SECONDS = 24 * 60 * 60;

/** IPv6 users hold a whole /64, so count the prefix, not the single address. */
function ipBucket(ip: string): string {
  if (!ip.includes(':') || ip.startsWith('::ffff:')) return ip;
  const [head] = ip.split('::');
  return head.split(':').slice(0, 4).join(':');
}

/**
 * Caps new accounts per client IP per day, so one person cannot spin up
 * accounts to farm the FREE quotas. Counted before the insert (atomic INCR),
 * and given back when registration fails.
 */
@Injectable()
export class SignupLimiter implements OnModuleDestroy {
  private readonly redis = newRedis();

  private readonly max = Number(process.env.MAX_SIGNUPS_PER_IP_PER_DAY || 3);

  private key(ip: string) {
    return `signups:${ipBucket(ip)}`;
  }

  async take(ip: string) {
    const key = this.key(ip);
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, DAY_SECONDS);
    if (count > this.max) {
      await this.redis.decr(key);
      throw new HttpException(
        'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi besok.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async release(ip: string) {
    await this.redis.decr(this.key(ip));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
