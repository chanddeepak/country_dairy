import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { MediaModule } from '../media/media.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [MediaModule, AuthModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
