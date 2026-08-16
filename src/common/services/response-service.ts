import { Injectable } from "@nestjs/common";
import { ApiResponse } from "../dto/api-response.dto";

@Injectable()
export class ResponseService {
    success<T>(data: T, message: string = 'Success', statusCode: number = 200): ApiResponse<T> {
        return ApiResponse.success(data, message, statusCode)
    }

    error(
        message: string,
        statusCode: number = 400,
        error?: string | string[],
    ): ApiResponse<null> {
        return ApiResponse.error(message, statusCode, error);
    }

    created<T>(data: T, message: string = 'Resource created successfully'): ApiResponse<T> {
        return ApiResponse.created(data, message);
    }

    noContent(message: string = 'Operation completed successfully'): ApiResponse<null> {
        return ApiResponse.noContent(message);
    }
}