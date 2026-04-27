import { Role } from '@prisma/client/index';
export declare class CreateUserDto {
    email: string;
    password: string;
    name: string;
    role: Role;
}
