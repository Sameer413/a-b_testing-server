export class ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error?: string | string[];
    statusCode: number;
    timestamp: string;

    constructor(
        success: boolean,
        message: string,
        data?: T,
        statusCode: number = 200,
        error?: string | string[],
    ) {
        this.success = success;
        this.message = message;
        this.data = data;
        this.error = error;
        this.statusCode = statusCode;
        this.timestamp = new Date().toISOString();
    }

    static success<T>(data: T, message: string = 'Success', statusCode: number = 200): ApiResponse<T> {
        return new ApiResponse<T>(true, message, data, statusCode);
    }

    static error(
        message: string,
        statusCode: number = 400,
        error?: string | string[],
    ): ApiResponse<null> {
        return new ApiResponse<null>(false, message, null, statusCode, error);
    }

    static created<T>(data: T, message: string = 'Resource created successfully'): ApiResponse<T> {
        return new ApiResponse(true, message, data, 201);
    }

    static noContent(message: string = 'Operation completed successfully'): ApiResponse<null> {
        return new ApiResponse(true, message, null, 204);
    }
}