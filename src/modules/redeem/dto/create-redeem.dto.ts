import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateRedeemDto {
  @ApiProperty({ example: 'uuid-of-reward' })
  @IsUUID()
  rewardId: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  receiverName: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  receiverPhone: string;

  @ApiProperty({ example: '123 Main St, City, Country' })
  @IsString()
  receiverAddress: string;
}
