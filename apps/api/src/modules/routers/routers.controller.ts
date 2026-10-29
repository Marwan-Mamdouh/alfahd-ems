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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  Role,
  type RouterDto,
  type RouterAssignmentDto,
  type RouterReportQueryDto,
} from '@alfahd/types';
import { routes } from '../../common/constants/routes.constants.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../../auth/strategies/jwt.strategy.js';
import { RoutersService } from './routers.service.js';
import {
  CreateRouterDto,
  AssignRouterDto,
  UpdateRouterConditionDto,
  TransitionRouterDto,
  RouterQueryDto,
} from './dto/index.js';

@ApiTags('Routers')
@ApiBearerAuth()
@Controller(routes.routers.root)
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutersController {
  constructor(private readonly routersService: RoutersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  @ApiOperation({ summary: 'Register a physical router asset or receive inbound stock' })
  @ApiCreatedResponse({ description: 'Router asset created successfully' })
  @ApiConflictResponse({ description: 'Serial number already exists' })
  create(@Body() dto: CreateRouterDto, @CurrentUser() user: JwtUser): Promise<RouterDto> {
    return this.routersService.create(dto, user.userId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS, Role.TECHNICIAN)
  @ApiOperation({ summary: 'List and search router hardware assets' })
  @ApiOkResponse({ description: 'Paginated list of router assets' })
  findAll(@Query() query: RouterQueryDto): Promise<{ items: RouterDto[]; total: number }> {
    return this.routersService.findAll(query);
  }

  @Post(routes.routers.export)
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Trigger async export of router inventory Excel report' })
  @ApiOkResponse({ description: 'Report job enqueued successfully' })
  exportReport(
    @Body() dto: RouterReportQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<{ jobId: string }> {
    return this.routersService.exportRouterReport(dto, user.userId);
  }

  @Get(routes.routers.id)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Get details of a specific router asset' })
  @ApiParam({ name: 'id', description: 'Router UUID' })
  @ApiOkResponse({ description: 'Router details' })
  @ApiNotFoundResponse({ description: 'Router not found' })
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<RouterDto> {
    return this.routersService.findById(id);
  }

  @Post(routes.routers.assign)
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  @ApiOperation({ summary: 'Assign a usable warehouse router to a technician' })
  @ApiParam({ name: 'id', description: 'Router UUID' })
  @ApiOkResponse({ description: 'Router assigned to technician successfully' })
  @ApiConflictResponse({ description: 'Router is not usable or available for assignment' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRouterDto,
    @CurrentUser() user: JwtUser,
  ): Promise<RouterDto> {
    return this.routersService.assign(id, dto, user.userId);
  }

  @Patch(routes.routers.transition)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  @ApiOperation({ summary: 'Transition router lifecycle status along the approved whitelist' })
  @ApiParam({ name: 'id', description: 'Router UUID' })
  @ApiOkResponse({ description: 'Router lifecycle status transitioned successfully' })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionRouterDto,
    @CurrentUser() user: JwtUser,
  ): Promise<RouterDto> {
    return this.routersService.transition(id, dto, user.userId);
  }

  @Patch(routes.routers.condition)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  @ApiOperation({
    summary: 'Update physical condition of a router (damages, repairs, inspections)',
  })
  @ApiParam({ name: 'id', description: 'Router UUID' })
  @ApiOkResponse({ description: 'Router condition updated and audit history recorded' })
  updateCondition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouterConditionDto,
    @CurrentUser() user: JwtUser,
  ): Promise<RouterDto> {
    return this.routersService.updateCondition(id, dto, user.userId);
  }

  @Get(routes.routers.assignments)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  @ApiOperation({ summary: 'Retrieve full custody assignment history of a router' })
  @ApiParam({ name: 'id', description: 'Router UUID' })
  @ApiOkResponse({ description: 'List of historical custody assignments' })
  getAssignments(@Param('id', ParseUUIDPipe) id: string): Promise<RouterAssignmentDto[]> {
    return this.routersService.getAssignments(id);
  }

  @Get(routes.routers.conditionHistory)
  @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
  @ApiOperation({ summary: 'Retrieve condition audit trail of a router' })
  @ApiParam({ name: 'id', description: 'Router UUID' })
  @ApiOkResponse({ description: 'List of historical physical condition changes' })
  getConditionHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.routersService.getConditionHistory(id);
  }
}
