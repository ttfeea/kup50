import { apiRequest } from './client';

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: 'employee' | 'manager';
    fullname?: string | null;
  };
};

export function loginRequest(email: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
