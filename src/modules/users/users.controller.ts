import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { ResponseService } from '../../common/services/response-service';
import { ApiResponse } from '../../common/dto/api-response.dto';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly responseService: ResponseService,
    ) { }

    /** Admin: list all users */
    @Roles(Role.ADMIN)
    @Get()
    async findAll(): Promise<ApiResponse<User[]>> {
        const users = await this.usersService.findAll();
        return this.responseService.success(users, 'Users retrieved successfully');
    }

    /** Any authenticated user: view own profile */
    @Get('me')
    async getProfile(@CurrentUser() user: User): Promise<ApiResponse<User>> {
        const profile = await this.usersService.findById(user.id);
        return this.responseService.success(profile, 'Profile retrieved successfully');
    }
    
    /** Any authenticated user: update own profile */
    // @Patch('me')
    // async updateProfile(
    //     @CurrentUser() user: User,
    //     @Body() updateUserDto: UpdateUserDto,
    // ): Promise<ApiResponse<User>> {
    //     const updatedUser = await this.usersService.update(user.id, updateUserDto);
    //     return this.responseService.success(updatedUser, 'Profile updated successfully');
    // }

    /** Admin: view any user by ID */
    @Roles(Role.ADMIN)
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<ApiResponse<User>> {
        const user = await this.usersService.findById(id);
        return this.responseService.success(user, 'User retrieved successfully');
    }

    /** Admin: update any user */
    // @Roles(Role.ADMIN)
    // @Patch(':id')
    // async update(
    //     @Param('id') id: string,
    //     @Body() updateUserDto: UpdateUserDto,
    // ): Promise<ApiResponse<User>> {
    //     const user = await this.usersService.update(id, updateUserDto);
    //     return this.responseService.success(user, 'User updated successfully');
    // }

    /** Admin: delete any user */
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
        await this.usersService.remove(id);
        return this.responseService.noContent('User deleted successfully');
    }
}
