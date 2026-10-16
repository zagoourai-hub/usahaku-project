import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Trim } from '../dto.decorators.js';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Trim()
  @IsString()
  @Length(1, 100)
  name: string;

  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email: string;

  // argon2 handles long input; cap to avoid hashing huge payloads
  @IsString()
  @Length(8, 128)
  password: string;

  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  businessName?: string;

  // Cloudflare Turnstile token; required only when TURNSTILE_SECRET_KEY is set
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string;
}

export class LoginDto {
  @Transform(trimLower)
  @IsEmail()
  email: string;

  @IsString()
  @Length(1, 128)
  password: string;
}
