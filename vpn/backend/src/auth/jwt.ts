import jwt from 'jsonwebtoken';
import { env } from '../env';

export interface TokenPayload {
  sub: string; // user id
  role: 'user' | 'admin';
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}
