import { User, Unsubscribe } from "firebase/auth";
import {
  remoteAuthRepository,
  RemoteAuthRepository,
} from "../data/remote/RemoteAuthRepository";

export class AuthService {
  constructor(private authRepo: RemoteAuthRepository = remoteAuthRepository) {}

  /**
   * Initializes anonymous session upon app startup.
   */
  async initializeSession(): Promise<User | null> {
    return this.authRepo.ensureAnonymousUser();
  }

  /**
   * Returns current authenticated user ID or null.
   */
  getCurrentUserId(): string | null {
    const user = this.authRepo.getCurrentUser();
    return user ? user.uid : null;
  }

  /**
   * Subscribes to changes in authentication state.
   */
  onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe {
    return this.authRepo.onAuthStateChanged(callback);
  }
}

export const authService = new AuthService();
