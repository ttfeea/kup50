import { apiRequest } from './client';

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: 'employee' | 'manager';
    fullname?: string | null;
    employeeId?: string | null;
    position?: string | null;
    department?: string | null;
    managerName?: string | null;
  };
};

export type UpdateMeInput = {
  fullname?: string;
  employeeId?: string;
  position?: string;
  department?: string;
  managerName?: string;
};

export function loginRequest(email: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getMeRequest(authToken: string) {
  return apiRequest<LoginResponse['user']>('/users/me', {
    token: authToken,
  });
}

export function updateMeRequest(authToken: string, body: UpdateMeInput) {
  return apiRequest<LoginResponse['user']>('/users/me', {
    method: 'PATCH',
    token: authToken,
    body: JSON.stringify(body),
  });
}
