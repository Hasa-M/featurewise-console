import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(180)
  readonly title!: string;
}
