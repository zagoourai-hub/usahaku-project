import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client.js';

// Maps known Prisma errors to HTTP errors without leaking query details.
// Anything else falls through to Nest's default handler (generic 500).
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    super.catch(toHttp(error) ?? error, host);
  }
}

function toHttp(
  error: Prisma.PrismaClientKnownRequestError,
): HttpException | undefined {
  switch (error.code) {
    case 'P2002':
      return new ConflictException('Data sudah ada');
    case 'P2003':
    case 'P2014':
      return new ConflictException('Data masih dipakai data lain');
    case 'P2025':
      return new NotFoundException('Data tidak ditemukan');
    default:
      return undefined;
  }
}
