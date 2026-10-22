import { BadRequestException, ValidationError, ValidationPipe } from "@nestjs/common";

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = "",
): Array<{ field: string; code: string; message: string }> {
  return errors.flatMap((error) => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownErrors = Object.entries(error.constraints ?? {}).map(([code, message]) => ({
      field,
      code,
      message,
    }));
    return [...ownErrors, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function createContractValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: flattenValidationErrors(errors),
      }),
  });
}
