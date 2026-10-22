import {
  IsOptional,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

const utcTimestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = utcTimestampPattern.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  date.setUTCHours(Number(hour), Number(minute), Number(second), 0);

  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day) &&
    date.getUTCHours() === Number(hour) &&
    date.getUTCMinutes() === Number(minute) &&
    date.getUTCSeconds() === Number(second)
  );
}

export function IsUtcTimestamp(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: "isUtcTimestamp",
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isUtcTimestamp(value);
        },
        defaultMessage(): string {
          return "Timestamp must be a valid RFC3339 UTC value ending in Z.";
        },
      },
    });
  };
}

@ValidatorConstraint({ name: "isAfterFrom", async: false })
class IsAfterFromConstraint implements ValidatorConstraintInterface {
  validate(to: unknown, arguments_: ValidationArguments): boolean {
    const from = (arguments_.object as UtcDateRangeQueryDto).from;
    if (from === undefined || to === undefined) {
      return true;
    }
    return Date.parse(from) < Date.parse(String(to));
  }

  defaultMessage(): string {
    return "The `from` timestamp must be earlier than `to`.";
  }
}

export class UtcDateRangeQueryDto {
  @IsOptional()
  @IsUtcTimestamp()
  from?: string;

  @IsOptional()
  @IsUtcTimestamp()
  @IsAfterFrom()
  to?: string;
}

export function IsAfterFrom(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: "isAfterFrom",
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: IsAfterFromConstraint,
    });
  };
}
