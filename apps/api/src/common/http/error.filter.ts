import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ApiRequest, ApiResponse } from "./request.types.js";

type ErrorDetail = { field: string; code: string; message: string };
type ContractError = {
  code?: string;
  message?: string;
  details?: ErrorDetail[];
};

const statusCodes = new Map<number, string>([
  [HttpStatus.BAD_REQUEST, "BAD_REQUEST"],
  [HttpStatus.UNAUTHORIZED, "UNAUTHORIZED"],
  [HttpStatus.FORBIDDEN, "FORBIDDEN"],
  [HttpStatus.NOT_FOUND, "NOT_FOUND"],
  [HttpStatus.CONFLICT, "CONFLICT"],
  [HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE"],
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE"],
  [HttpStatus.UNPROCESSABLE_ENTITY, "UNPROCESSABLE_ENTITY"],
  [HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_REQUESTS"],
  [HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE"],
]);

@Catch()
export class ContractErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<ApiRequest>();
    const response = context.getResponse<ApiResponse>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const contractError = this.readContractError(payload);
    const requestId = request.requestId ?? randomUUID();

    response.setHeader("X-Request-Id", requestId);
    response.status(status).json({
      error: {
        code:
          status >= 500
            ? "INTERNAL_ERROR"
            : (contractError.code ?? statusCodes.get(status) ?? "HTTP_ERROR"),
        message:
          status >= 500
            ? "An unexpected error occurred."
            : (contractError.message ?? this.defaultMessage(status)),
        ...(status < 500 && contractError.details ? { details: contractError.details } : {}),
        requestId,
      },
    });
  }

  private readContractError(payload: unknown): ContractError {
    if (typeof payload !== "object" || payload === null) {
      return {};
    }

    const candidate = payload as Record<string, unknown>;
    if (typeof candidate.code !== "string") {
      return {};
    }
    const details = candidate.details;
    return {
      code: candidate.code,
      ...(typeof candidate.message === "string" ? { message: candidate.message } : {}),
      ...(Array.isArray(details) && this.isErrorDetails(details) ? { details } : {}),
    };
  }

  private isErrorDetails(details: unknown[]): details is ErrorDetail[] {
    return details.every(
      (detail) =>
        typeof detail === "object" &&
        detail !== null &&
        "field" in detail &&
        typeof detail.field === "string" &&
        "code" in detail &&
        typeof detail.code === "string" &&
        "message" in detail &&
        typeof detail.message === "string",
    );
  }

  private defaultMessage(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) return "Request validation failed.";
    if (status === HttpStatus.UNAUTHORIZED) return "Authentication is required.";
    if (status === HttpStatus.FORBIDDEN) return "You are not allowed to perform this action.";
    if (status === HttpStatus.NOT_FOUND) return "The requested resource was not found.";
    if (status === HttpStatus.CONFLICT)
      return "The request conflicts with the current resource state.";
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) return "The request payload is too large.";
    if (status === HttpStatus.UNSUPPORTED_MEDIA_TYPE)
      return "The request media type is not supported.";
    if (status === HttpStatus.UNPROCESSABLE_ENTITY) return "The request could not be processed.";
    if (status === HttpStatus.TOO_MANY_REQUESTS) return "Too many requests.";
    if (status === HttpStatus.SERVICE_UNAVAILABLE) return "The service is not ready.";
    return "The request could not be completed.";
  }
}
