import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export interface User {
  email: string;
  admin: boolean;
  name?: string;
}

interface ProtectedRouteProps {
  user: User | undefined;
  isAuth: boolean;
}

export function ProtectedRoute({ user, isAuth }: ProtectedRouteProps) {
  return isAuth ? <Outlet /> : <Navigate to="/login" />;
}
