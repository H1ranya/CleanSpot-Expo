import {
  signInAnonymously,
  onAuthStateChanged,
  User,
  Unsubscribe,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebaseConfig";

const LOCAL_USER_UID_KEY = "@cleanspot_local_user_uid";

export class RemoteAuthRepository {
  private auth = getFirebaseAuth();
  private localUserUid: string | null = null;
  private listeners: Set<(user: User | null) => void> = new Set();

  /**
   * Ensures an authenticated anonymous user exists in Firebase Cloud.
   * 1. If Firebase Auth has a persistent currentUser, reuses it.
   * 2. Attempts signInAnonymously with Firebase Cloud Auth.
   * 3. If Anonymous Auth is not enabled in Firebase Console or network is unreachable,
   *    falls back to a persistent local user session in AsyncStorage without crashing.
   */
  async ensureAnonymousUser(): Promise<User | null> {
    if (!isFirebaseConfigured()) {
      return null;
    }

    // 1. Check existing Firebase user
    if (this.auth.currentUser) {
      return this.auth.currentUser;
    }

    // 2. Try anonymous sign-in
    try {
      const credential = await signInAnonymously(this.auth);
      return credential.user;
    } catch (error: any) {
      const errorCode = error?.code || "";
      const errorMessage = error?.message || "";

      // Check if error is due to unconfigured/disabled provider in console or network
      if (
        errorCode === "auth/api-key-not-valid" ||
        errorCode === "auth/network-request-failed" ||
        errorCode === "auth/configuration-not-found" ||
        errorCode === "auth/operation-not-allowed" ||
        errorCode === "auth/admin-restricted-operation" ||
        errorMessage.includes("api-key-not-valid") ||
        errorMessage.includes("configuration-not-found")
      ) {
        if (errorCode === "auth/configuration-not-found" || errorCode === "auth/operation-not-allowed") {
          console.warn(
            "[RemoteAuthRepository] Anonymous Sign-In is not enabled in Firebase Console for this project. To enable it: Go to Firebase Console > Authentication > Sign-in method > Enable Anonymous. Falling back to persistent local user session.",
          );
        } else {
          console.warn(
            "[RemoteAuthRepository] Using persistent local user session (Network unreachable or Firebase Auth credentials invalid).",
          );
        }
        const uid = await this.getOrCreateLocalUserUid();
        const fallbackUser = { uid, isAnonymous: true } as unknown as User;
        this.notifyListeners(fallbackUser);
        return fallbackUser;
      }

      console.error(
        "[RemoteAuthRepository] Failed to sign in anonymously:",
        error,
      );
      throw error;
    }
  }

  private async getOrCreateLocalUserUid(): Promise<string> {
    if (this.localUserUid) {
      return this.localUserUid;
    }

    try {
      const stored = await AsyncStorage.getItem(LOCAL_USER_UID_KEY);
      if (stored) {
        this.localUserUid = stored;
        return stored;
      }

      const generated = `user_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
      await AsyncStorage.setItem(LOCAL_USER_UID_KEY, generated);
      this.localUserUid = generated;
      return generated;
    } catch {
      const generated = `user_${Date.now().toString(36)}`;
      this.localUserUid = generated;
      return generated;
    }
  }

  getCurrentUser(): User | null {
    if (this.auth.currentUser) {
      return this.auth.currentUser;
    }
    if (this.localUserUid) {
      return {
        uid: this.localUserUid,
        isAnonymous: true,
      } as unknown as User;
    }
    return null;
  }

  getCurrentUserId(): string | null {
    return this.auth.currentUser?.uid || this.localUserUid;
  }

  onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe {
    this.listeners.add(callback);

    // Also register with Firebase Auth
    const unsub = onAuthStateChanged(this.auth, (user) => {
      if (user) {
        callback(user);
      } else if (this.localUserUid) {
        callback({
          uid: this.localUserUid,
          isAnonymous: true,
        } as unknown as User);
      } else {
        callback(null);
      }
    });

    return () => {
      this.listeners.delete(callback);
      unsub();
    };
  }

  private notifyListeners(user: User | null) {
    this.listeners.forEach((listener) => {
      try {
        listener(user);
      } catch (e) {
        console.warn("[RemoteAuthRepository] Error notifying listener:", e);
      }
    });
  }
}

export const remoteAuthRepository = new RemoteAuthRepository();
