import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const hadUserRef = useRef(false);

  // Track if we ever had a user to prevent flash during refresh
  useEffect(() => {
    if (user) {
      hadUserRef.current = true;
    }
  }, [user]);

  // Add a grace period before redirecting
  // This prevents flash during token refresh
  useEffect(() => {
    if (!loading) {
      // If we previously had a user and now don't, wait a bit before redirecting
      // This gives the token refresh time to complete
      const delay = hadUserRef.current && !user ? 200 : 50;
      const timer = setTimeout(() => {
        setIsChecking(false);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setIsChecking(true);
    }
  }, [loading, user]);

  if (loading || isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
