import { Response } from 'express';

export interface UserType {
  id: string;
  name: string;
  email: string;
}

export type AuthContext = {
  user: UserType;
};

export interface ContextType {
  res: Response;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    accountType: string;
  };
}
