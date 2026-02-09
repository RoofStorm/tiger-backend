import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, ValidateIf } from 'class-validator';

export class CreateRedeemDto {
  @ApiProperty({ example: 'voucher-100k' })
  @IsString()
  @IsNotEmpty()
  rewardId: string;

  @ApiProperty({
    example: '0901234567',
    description: 'Số điện thoại người nhận. Bắt buộc nếu không có receiverEmail.',
    required: false,
  })
  @ValidateIf((o) => !o.receiverEmail?.trim())
  @IsString()
  @IsNotEmpty({ message: 'Cần ít nhất một trong hai: số điện thoại hoặc email' })
  receiverPhone?: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Email người nhận. Bắt buộc nếu không có receiverPhone.',
    required: false,
  })
  @ValidateIf((o) => !o.receiverPhone?.trim())
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Cần ít nhất một trong hai: số điện thoại hoặc email' })
  receiverEmail?: string;
}
