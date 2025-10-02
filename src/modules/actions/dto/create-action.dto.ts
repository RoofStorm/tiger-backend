import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { ActionType } from '@prisma/client';

export class CreateActionDto {
  @ApiProperty({ enum: ActionType, example: ActionType.LIKE })
  @IsEnum(ActionType)
  type: ActionType;

  @ApiProperty({ example: 'post-uuid-here' })
  @IsString()
  postId: string;
}

