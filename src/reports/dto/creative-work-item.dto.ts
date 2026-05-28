import { IsIn, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { CREATIVE_WORK_ITEM_TYPES } from '../types/creative-work-item.type';

export class CreativeWorkItemDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsIn(CREATIVE_WORK_ITEM_TYPES)
  type: (typeof CREATIVE_WORK_ITEM_TYPES)[number];

  @IsOptional()
  @IsUrl()
  url?: string;
}
