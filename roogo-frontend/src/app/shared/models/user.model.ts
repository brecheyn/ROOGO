export interface User {
  id?: number;
  username: string;
  email: string;
  organizationName?: string;
  role?: 'OWNER' | 'MANAGER' | 'VENDEUR' | 'superadmin' ;
  isCreator?: boolean;
  token?: string;
  subdomain?: string;
  plan?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  organizationName: string;
  subdomain?: string;
  phone?: string;
  plan?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}