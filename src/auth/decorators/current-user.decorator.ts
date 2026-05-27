import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SafeUser } from '../../common/utils/user.mapper';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SafeUser => {
    const request = ctx.switchToHttp().getRequest<{ user: SafeUser }>();
    return request.user;
  },
);
