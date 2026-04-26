import { IsEnum } from 'class-validator';
import { Role } from '@prisma/client/index';

export class UpdateRoleDto {
  @IsEnum(Role)
  role!: Role;
}
