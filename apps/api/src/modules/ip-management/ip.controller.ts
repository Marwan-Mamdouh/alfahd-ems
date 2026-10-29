import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role, type IpAddressDto, type IpHistoryDto, type IpImportResultDto } from '@alfahd/types';
import { routes } from '../../common/constants/routes.constants.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../../auth/strategies/jwt.strategy.js';
import { IpService } from './ip.service.js';
import { CreateIpDto, UpdateIpDto, IpQueryDto } from './dto/index.js';

@ApiTags('IP Management')
@ApiBearerAuth()
@Controller(routes.ip.root)
@UseGuards(JwtAuthGuard, RolesGuard)
export class IpController {
  constructor(private readonly ipService: IpService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Register a new individual IPv4 address' })
  @ApiCreatedResponse({ description: 'IP address registered' })
  create(@Body() dto: CreateIpDto, @CurrentUser() user: JwtUser): Promise<IpAddressDto> {
    return this.ipService.create(dto, user.userId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'List and search IP addresses' })
  @ApiOkResponse({ description: 'Paginated list of IP addresses' })
  findAll(@Query() query: IpQueryDto): Promise<{ items: IpAddressDto[]; total: number }> {
    return this.ipService.findAll(query);
  }

  @Get(routes.ip.id)
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Get details of an IP address' })
  @ApiParam({ name: 'id', description: 'IP UUID' })
  @ApiOkResponse({ description: 'IP address details' })
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<IpAddressDto> {
    return this.ipService.findById(id);
  }

  @Patch(routes.ip.id)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update IP address metadata notes' })
  @ApiParam({ name: 'id', description: 'IP UUID' })
  @ApiOkResponse({ description: 'IP address updated' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIpDto,
    @CurrentUser() user: JwtUser,
  ): Promise<IpAddressDto> {
    return this.ipService.update(id, dto, user.userId);
  }

  @Post(routes.ip.reserve)
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Manually reserve an available FREE IP address' })
  @ApiParam({ name: 'id', description: 'IP UUID' })
  @ApiOkResponse({ description: 'IP address marked RESERVED' })
  reserve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: JwtUser,
  ): Promise<IpAddressDto> {
    return this.ipService.reserve(id, reason, user.userId);
  }

  @Post(routes.ip.release)
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Release a RESERVED IP address back to FREE' })
  @ApiParam({ name: 'id', description: 'IP UUID' })
  @ApiOkResponse({ description: 'IP address marked FREE' })
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: JwtUser,
  ): Promise<IpAddressDto> {
    return this.ipService.release(id, reason, user.userId);
  }

  @Post(routes.ip.archive)
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Archive a FREE IP address so it cannot be allocated' })
  @ApiParam({ name: 'id', description: 'IP UUID' })
  @ApiOkResponse({ description: 'IP address archived' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: JwtUser,
  ): Promise<IpAddressDto> {
    return this.ipService.archive(id, reason, user.userId);
  }

  @Post(routes.ip.unarchive)
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Unarchive an archived IP address' })
  @ApiParam({ name: 'id', description: 'IP UUID' })
  @ApiOkResponse({ description: 'IP address unarchived' })
  unarchive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: JwtUser,
  ): Promise<IpAddressDto> {
    return this.ipService.unarchive(id, reason, user.userId);
  }

  @Get(routes.ip.history)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get full mutation audit history for an IP address' })
  @ApiParam({ name: 'id', description: 'IP UUID' })
  @ApiOkResponse({ description: 'List of historical mutations' })
  getHistory(@Param('id', ParseUUIDPipe) id: string): Promise<IpHistoryDto[]> {
    return this.ipService.getHistory(id);
  }

  @Post(routes.ip.import)
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk import IPv4 addresses from CSV' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file with address,notes headers',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Import outcome summary' })
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
  ): Promise<IpImportResultDto> {
    const content = file?.buffer ? file.buffer.toString('utf-8') : '';
    return this.ipService.importCsv(content, user.userId);
  }
}
