import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail } from 'class-validator';

export class CreateRedeemDto {
  @ApiProperty({ example: 'voucher-100k' })
  @IsString()
  rewardId: string;

  @ApiProperty({ example: '123123123' })
  @IsString()
  receiverPhone: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  receiverEmail: string;
}
