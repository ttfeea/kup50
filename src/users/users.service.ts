import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface CreateUserData {
  email: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserData {
  fullname?: string | null;
  employeeId?: string | null;
  position?: string | null;
  department?: string | null;
  managerName?: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        role: data.role ?? UserRole.employee,
      },
    });
  }

  updateById(id: string, data: UpdateUserData): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        fullname: data.fullname,
        employeeId: data.employeeId,
        position: data.position,
        department: data.department,
        managerName: data.managerName,
      },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
