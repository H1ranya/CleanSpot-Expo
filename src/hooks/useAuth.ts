import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { authService } from '../services/AuthService';
import { isFirebaseConfigured } from '../data/remote/firebaseConfig';

export interface AuthState {
  user: User | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    let isMounted = true;

    // Listen to persistent auth state changes
    const unsubscribe = authService.onAuthStateChanged((currentUser) => {
      if (isMounted) {
        setUser(currentUser);
        setIsLoading(false);
      }
    });

    // Ensure anonymous user session on startup
    authService
      .initializeSession()
      .then((authenticatedUser) => {
        if (isMounted && authenticatedUser) {
          setUser(authenticatedUser);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Authentication failed');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return {
    user,
    userId: user?.uid ?? null,
    isAuthenticated: Boolean(user),
    isLoading,
    isConfigured: configured,
    error,
  };
}
