import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  companyEmailDomain: process.env.COMPANY_EMAIL_DOMAIN ?? '@precisely.com',
}));
