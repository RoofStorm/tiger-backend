import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateWishDto {
  @ApiProperty({
    example:
      'Tinh thần yêu nước là một truyền thống quý báu của dân tộc Việt Nam...',
    description: 'Nội dung lời chúc',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, { message: 'Lời chúc không được quá 1000 ký tự' })
  content: string;
}
