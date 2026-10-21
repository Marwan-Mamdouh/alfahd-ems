import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Multer's LIMIT_FILE_SIZE is translated to PayloadTooLargeException (413)
    // by @nestjs/platform-express. Normalize it to 400 with a machine-readable
    // code so clients can distinguish "upload too big" from other failures.
    if (exception instanceof PayloadTooLargeException) {
      const message = 'File exceeds the maximum allowed upload size';
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: {
          code: 'FILE_TOO_LARGE',
          message,
        },
        path: request.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!(exception instanceof HttpException)) {
      const detail = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`Unhandled exception on ${request.method} ${request.path}: ${detail}`);
    }

    const rawResponse =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    let normalizedMessage: string;
    let code = 'ERROR';
    let details: unknown = undefined;

    if (typeof rawResponse === 'string') {
      normalizedMessage = rawResponse;
    } else if (Array.isArray(rawResponse)) {
      normalizedMessage = rawResponse.join(', ');
    } else if (rawResponse && typeof rawResponse === 'object') {
      const resObj = rawResponse as Record<string, unknown>;
      if ('code' in resObj && typeof resObj.code === 'string') {
        code = resObj.code;
      }
      if ('details' in resObj) {
        details = resObj.details;
      }
      if ('message' in resObj) {
        normalizedMessage = Array.isArray(resObj.message)
          ? resObj.message.join(', ')
          : String(resObj.message ?? 'Internal server error');
      } else {
        normalizedMessage = 'Internal server error';
      }
    } else {
      normalizedMessage = 'Internal server error';
    }

    response.status(status).json({
      statusCode: status,
      message: normalizedMessage,
      error: {
        code,
        message: normalizedMessage,
        ...(details !== undefined ? { details } : {}),
      },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
