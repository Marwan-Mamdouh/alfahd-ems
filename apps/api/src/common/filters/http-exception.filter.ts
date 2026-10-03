import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // A bare `@Catch()` filter turns every unexpected error into an opaque 500 and
    // logs nothing, so an unhandled exception is undiagnosable from the response
    // or the server log. Log the cause; never the request body (it carries
    // passwords on the auth routes). `request.path` excludes the query string so
    // a token or key passed as a query param cannot land in the log either.
    if (!(exception instanceof HttpException)) {
      const detail = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`Unhandled exception on ${request.method} ${request.path}: ${detail}`);
    }

    const rawMessage =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    let normalizedMessage: string;
    if (typeof rawMessage === 'string') {
      normalizedMessage = rawMessage;
    } else if (Array.isArray(rawMessage)) {
      normalizedMessage = rawMessage.join(', ');
    } else if (rawMessage && typeof rawMessage === 'object' && 'message' in rawMessage) {
      const msg = (rawMessage as Record<string, unknown>).message;
      normalizedMessage = Array.isArray(msg)
        ? msg.join(', ')
        : String(msg ?? 'Internal server error');
    } else {
      normalizedMessage = 'Internal server error';
    }

    response.status(status).json({
      statusCode: status,
      message: normalizedMessage,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
