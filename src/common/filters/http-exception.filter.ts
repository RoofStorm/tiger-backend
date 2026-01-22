import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi máy chủ nội bộ';
    let error = 'Lỗi máy chủ';

    // Handle Multer errors (file upload errors)
    if (exception instanceof MulterError) {
      const maxFileSize = parseInt(
        process.env.MAX_FILE_SIZE || '10485760', // 10MB default
      );
      const maxFileSizeMB = (maxFileSize / (1024 * 1024)).toFixed(0);

      switch (exception.code) {
        case 'LIMIT_FILE_SIZE':
          status = HttpStatus.BAD_REQUEST;
          message = `Kích thước file vượt quá giới hạn cho phép là ${maxFileSizeMB}MB.`;
          error = 'File quá lớn';
          break;
        case 'LIMIT_FILE_COUNT':
          status = HttpStatus.BAD_REQUEST;
          message = 'Quá nhiều file. Chỉ cho phép tải lên 1 file.';
          error = 'Quá nhiều file';
          break;
        case 'LIMIT_UNEXPECTED_FILE':
          status = HttpStatus.BAD_REQUEST;
          message = 'Trường file không hợp lệ.';
          error = 'Trường file không hợp lệ';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = `Lỗi tải file lên: ${exception.message}`;
          error = 'Lỗi tải file';
      }

      this.logger.error(
        `❌ Multer error - Code: ${exception.code}, Message: ${message}, Path: ${request.url}`,
      );
    }
    // Handle NestJS HttpException
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.name;
      } else {
        message = exception.message;
      }
    }
    // Handle other errors (including fileFilter errors from multer)
    else if (exception instanceof Error) {
      // Nếu là lỗi liên quan đến file upload (message chứa "file" hoặc "ảnh")
      const errorMessage = exception.message.toLowerCase();
      if (
        errorMessage.includes('file') ||
        errorMessage.includes('ảnh') ||
        errorMessage.includes('loại file') ||
        errorMessage.includes('kích thước')
      ) {
        status = HttpStatus.BAD_REQUEST;
        error = 'Lỗi tải file';
      }
      message = exception.message;
      this.logger.error(
        `❌ Unhandled error - ${exception.message}`,
        exception.stack,
      );
    }

    const errorResponse = {
      success: false,
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}

