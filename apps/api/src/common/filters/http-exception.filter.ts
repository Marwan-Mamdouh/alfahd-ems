import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

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
