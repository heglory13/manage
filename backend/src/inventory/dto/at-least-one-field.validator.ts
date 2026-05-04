import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function AtLeastOneField(
  fields: string[],
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'atLeastOneField',
      target: object.constructor,
      propertyName,
      constraints: fields,
      options: validationOptions,
      validator: {
        validate(_: unknown, args: ValidationArguments) {
          const target = args.object as Record<string, unknown>;
          return (args.constraints as string[]).some((field) => {
            const value = target[field];
            return typeof value === 'string'
              ? value.trim().length > 0
              : value !== undefined && value !== null;
          });
        },
      },
    });
  };
}
