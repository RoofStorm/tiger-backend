import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class ProductCardClickDto {
  @ApiProperty({
    example: 5,
    description: 'Number of product card clicks to process (1-100)',
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  clickCount: number;
}

