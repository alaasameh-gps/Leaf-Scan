import jwt from "jsonwebtoken";

const SECRET = process.env.AUTH_SECRET || '';

export function signToken(payload: object) {
  if (!SECRET) throw new Error('AUTH_SECRET not configured');
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  if (!SECRET) throw new Error('AUTH_SECRET not configured');
  return jwt.verify(token, SECRET);
}
