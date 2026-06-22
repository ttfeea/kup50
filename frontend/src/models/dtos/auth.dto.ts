export type UserRole = 'employee' | 'manager';

export type UserDto = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  fullname: string | null;
  employeeId: string | null;
  position: string | null;
  department: string | null;
  managerName: string | null;
  managerEmail: string | null;
  reportReceiverEmail: string | null;
  reportCcEmail: string | null;
  reportEmailSubjectTemplate: string | null;
  reportEmailBodyTemplate: string | null;
};

export type LoginResponseDto = {
  accessToken: string;
  user: UserDto;
};

export type UpdateUserDto = {
  fullname?: string;
  employeeId?: string;
  position?: string;
  department?: string;
  managerName?: string;
  managerEmail?: string;
  reportReceiverEmail?: string;
  reportCcEmail?: string;
  reportEmailSubjectTemplate?: string;
  reportEmailBodyTemplate?: string;
};
