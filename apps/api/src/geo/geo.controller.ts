import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  /**
   * Public on purpose. Someone filling in a delivery address has not
   * necessarily signed in yet, and a PIN code is not personal data — it is
   * the same postal directory anyone can look up.
   */
  @Get('pincode/:pincode')
  async pincode(@Param('pincode') pincode: string) {
    const found = await this.geo.lookup(pincode);
    // 404 rather than an empty 200: "we could not place this" and "this is
    // not a real PIN code" are the same thing to the person typing, and the
    // page should not have to tell them apart.
    if (!found) throw new NotFoundException('No such PIN code');
    return found;
  }
}
