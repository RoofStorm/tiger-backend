import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiverInfoDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '123 Main St, City, Country' })
  @IsString()
  address: string;
}

export class CreateRedeemDto {
  @ApiProperty({ example: 'voucher50k' })
  @IsString()
  giftCode: string;

  @ApiProperty({ type: ReceiverInfoDto })
  @ValidateNested()
  @Type(() => ReceiverInfoDto)
  receiverInfo: ReceiverInfoDto;

  @ApiProperty({ enum: ['points', 'life'], example: 'points' })
  @IsEnum(['points', 'life'])
  payWith: 'points' | 'life';
}

