import { apiRequest } from './client';
import { UserDto } from './contracts';

export type LoginResponse = {
  accessToken: string;
  user: UserDto;
};

export type UpdateMeInput = {
  fullname?: string;
  employeeId?: string;
  position?: string;
  department?: string;
  managerName?: string;
  managerEmail?: string;
  reportReceiverEmail?: string;
  reportEmailSubjectTemplate?: string;
  reportEmailBodyTemplate?: string;
};

export function loginRequest(email: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function getMeRequest(authToken: string) {
  return apiRequest<UserDto>('/users/me', {
    token: authToken,
  });
}

export function updateMeRequest(authToken: string, body: UpdateMeInput) {
  return apiRequest<UserDto>('/users/me', {
    method: 'PATCH',
    token: authToken,
    body: JSON.stringify(body),
  });
}
