import { User } from '@prisma/client';

export type SafeUser = User;

export function toSafeUser(user: User): SafeUser {
  return user;
}
