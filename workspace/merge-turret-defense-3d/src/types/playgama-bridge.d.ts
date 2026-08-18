declare module '@playgama/bridge' {
  type Listener = (payload: unknown) => void;

  const bridge: {
    initialize: () => Promise<void>;
    setGameLoadingProgress?: (progress: number) => void;
    EVENT_NAME?: {
      PAUSE_STATE_CHANGED?: string;
      AUDIO_STATE_CHANGED?: string;
      REWARDED_STATE_CHANGED?: string;
    };
    platform: {
      id?: string;
      language?: string;
      isPaused?: boolean;
      isAudioEnabled?: boolean;
      sendMessage?: (message: string) => void;
      getServerTime?: () => Promise<number>;
      on?: (eventName: string, listener: Listener) => void;
      off?: (eventName: string, listener: Listener) => void;
    };
    player?: {
      id?: string | null;
      name?: string | null;
      isGuest?: boolean;
      isAuthorized?: boolean;
      isAuthorizationSupported?: boolean;
      authorize?: () => Promise<boolean | void>;
    };
    storage?: {
      get: (key: string) => Promise<unknown>;
      set: (key: string, value: string) => Promise<void>;
    };
    advertisement?: {
      isRewardedSupported?: boolean;
      isInterstitialSupported?: boolean;
      isBannerSupported?: boolean;
      showRewarded?: (placement?: string) => Promise<void>;
      showInterstitial?: (placement?: string) => Promise<void>;
      showBanner?: (position?: string) => Promise<void>;
    };
    leaderboard?: {
      isSupported?: boolean;
      setScore?: (id: string, score: number) => Promise<void>;
    };
  };

  export default bridge;
}
