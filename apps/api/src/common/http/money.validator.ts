import { registerDecorator, ValidationOptions } from "class-validator";

export type VndAmountOptions = {
  allowZero?: boolean;
};

export function IsVndAmount(
  options: VndAmountOptions = {},
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  const allowZero = options.allowZero ?? true;
  return (target, propertyName) => {
    registerDecorator({
      name: "isVndAmount",
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== "string" || !/^(0|[1-9]\d{0,17})$/.test(value)) {
            return false;
          }
          return allowZero || value !== "0";
        },
        defaultMessage(): string {
          return allowZero
            ? "Amount must be a non-negative integer VND string with at most 18 digits."
            : "Amount must be a positive integer VND string with at most 18 digits.";
        },
      },
    });
  };
}
