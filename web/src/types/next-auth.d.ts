import 'next-auth';
import 'next-auth/jwt';
import type { Role } from '@/types';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      avatarUrl?: string | null;
      accessToken?: string;
      refreshToken?: string;
    };
  }
  interface User {
    id: string;
    role?: Role;
    accessToken?: string;
    refreshToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: Role;
    accessToken?: string;
    refreshToken?: string;
    error?: 'RefreshTokenError';
  }
}
