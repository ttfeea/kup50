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
  reportEmailSubjectTemplate: string | null;
  reportEmailBodyTemplate: string | null;
};
