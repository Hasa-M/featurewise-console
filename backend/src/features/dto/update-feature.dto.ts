import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateFeatureDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(180)
  readonly title!: string;
}
