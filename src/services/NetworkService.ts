import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
  NetInfoStateType,
} from "@react-native-community/netinfo";

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isOnline: boolean;
  connectionType: NetInfoStateType;
}

export type NetworkChangeListener = (
  isOnline: boolean,
  state: NetworkState,
) => void;

/**
 * Domain service managing network connectivity detection and event subscription.
 * Decouples NetInfo from UI screens and enables background services (like SyncService)
 * to listen for online events.
 */
export class NetworkService {
  private currentState: NetworkState = {
    isConnected: true,
    isInternetReachable: null,
    isOnline: true,
    connectionType: NetInfoStateType.unknown,
  };

  private listeners: Set<NetworkChangeListener> = new Set();
  private subscription: NetInfoSubscription | null = null;
  private isListening = false;

  constructor() {
    this.startListening();
  }

  /**
   * Translates NetInfoState into our domain NetworkState.
   * Device is considered online when connected and internet is not confirmed unreachable.
   */
  private parseState(state: NetInfoState): NetworkState {
    const isConnected = Boolean(state.isConnected);
    // isInternetReachable can be null while testing reachability; treat null as optimistic true if connected
    const isInternetReachable = state.isInternetReachable;
    const isOnline = isConnected && isInternetReachable !== false;

    return {
      isConnected,
      isInternetReachable,
      isOnline,
      connectionType: state.type,
    };
  }

  /**
   * Starts listening to NetInfo events if not already listening.
   */
  private startListening(): void {
    if (this.isListening) {
      return;
    }

    // Initial fetch
    NetInfo.fetch()
      .then((state) => {
        this.currentState = this.parseState(state);
      })
      .catch((err) => {
        console.warn(
          "[NetworkService] Failed to fetch initial network state:",
          err,
        );
      });

    // Event listener
    this.subscription = NetInfo.addEventListener((state) => {
      const prevOnline = this.currentState.isOnline;
      this.currentState = this.parseState(state);

      // Notify all registered listeners
      this.listeners.forEach((listener) => {
        try {
          listener(this.currentState.isOnline, this.currentState);
        } catch (e) {
          console.warn("[NetworkService] Error in network listener:", e);
        }
      });
    });

    this.isListening = true;
  }

  /**
   * Returns whether the device is currently online.
   */
  isOnline(): boolean {
    return this.currentState.isOnline;
  }

  /**
   * Actively fetches the latest network state from NetInfo.
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.currentState = this.parseState(state);
      return this.currentState.isOnline;
    } catch {
      return this.currentState.isOnline;
    }
  }

  /**
   * Returns the current detailed network state snapshot.
   */
  getNetworkState(): NetworkState {
    return { ...this.currentState };
  }

  /**
   * Subscribes to network connectivity transitions.
   * Returns an unsubscribe function to clean up the listener.
   */
  subscribe(listener: NetworkChangeListener): () => void {
    this.listeners.add(listener);

    // Call listener immediately with current state
    try {
      listener(this.currentState.isOnline, this.currentState);
    } catch (e) {
      console.warn("[NetworkService] Error in immediate network callback:", e);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Cleans up all listeners and native subscription.
   */
  destroy(): void {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
    this.listeners.clear();
    this.isListening = false;
  }
}

export const networkService = new NetworkService();
