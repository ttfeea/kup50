import type {
  LoginResponseDto,
  UpdateUserDto,
  UserDto,
} from '../models/dtos/auth.dto';
import { apiRequest } from './client';

export function loginRequest(email: string) {
  return apiRequest<LoginResponseDto>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function getMeRequest(authToken: string) {
  return apiRequest<UserDto>('/users/me', {
    token: authToken,
  });
}

export function updateMeRequest(authToken: string, body: UpdateUserDto) {
  return apiRequest<UserDto>('/users/me', {
    method: 'PATCH',
    token: authToken,
    body: JSON.stringify(body),
  });
}
