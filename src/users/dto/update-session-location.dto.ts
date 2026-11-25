import { Max, Min, IsNumber } from 'class-validator';

export class UpdateSessionLocationDto {
  @Max(90)
  @Min(-90)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  latitude: number;

  @Max(180)
  @Min(-180)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  longitude: number;
}
