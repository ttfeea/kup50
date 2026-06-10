import { User } from '@prisma/client';

export type SafeUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'role'
  | 'createdAt'
  | 'fullname'
  | 'position'
  | 'department'
  | 'managerName'
  | 'managerEmail'
  | 'reportReceiverEmail'
  | 'reportEmailSubjectTemplate'
  | 'reportEmailBodyTemplate'
  | 'employeeId'
>;

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    fullname: user.fullname,
    position: user.position,
    department: user.department,
    managerName: user.managerName,
    managerEmail: user.managerEmail,
    reportReceiverEmail: user.reportReceiverEmail,
    reportEmailSubjectTemplate: user.reportEmailSubjectTemplate,
    reportEmailBodyTemplate: user.reportEmailBodyTemplate,
    employeeId: user.employeeId,
  };
}
