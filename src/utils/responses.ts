export class ErrorResponse extends Error {
  code: number;
  message: string;
  details?: string;

  constructor(code: number, message: string, details?: string) {
    super(message);
    this.code = code;
    this.message = message;
    this.details = details;
    this.name = this.constructor.name;
  }
}

export class SuccessResponse<T = any> {
  code: number;
  success: boolean;
  data?: T;
  token?: string;

  constructor(code: number, success: boolean, data?: T, token?: string) {
    this.code = code;
    this.success = success;
    if (data) this.data = data;
    if (token) this.token = token;
  }
}

export class AuthPayload<T = any> {
  entity?: T;
  token?: string;

  constructor(entity?: T, token?: string) {
    if (entity) this.entity = entity;
    if (token) this.token = token;
  }
}
