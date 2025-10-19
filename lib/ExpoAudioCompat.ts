import type {
  AudioMode,
  AudioSource,
  AudioStatus,
  PitchCorrectionQuality,
} from 'expo-audio';
import {
  PLAYBACK_STATUS_UPDATE,
  createAudioPlayer,
  getRecordingPermissionsAsync as expoGetRecordingPermissionsAsync,
  requestRecordingPermissionsAsync as expoRequestRecordingPermissionsAsync,
  setAudioModeAsync as expoSetAudioModeAsync,
  setIsAudioActiveAsync as expoSetIsAudioActiveAsync,
} from 'expo-audio';
import type { EventSubscription } from 'expo-modules-core';

type LegacyInterruptionModeIOS =
  | typeof InterruptionModeIOS[keyof typeof InterruptionModeIOS];
type LegacyInterruptionModeAndroid =
  | typeof InterruptionModeAndroid[keyof typeof InterruptionModeAndroid];

type LegacyAudioMode = {
  allowsRecordingIOS?: boolean;
  interruptionModeIOS?: LegacyInterruptionModeIOS;
  playsInSilentModeIOS?: boolean;
  staysActiveInBackground?: boolean;
  shouldDuckAndroid?: boolean;
  interruptionModeAndroid?: LegacyInterruptionModeAndroid;
  playThroughEarpieceAndroid?: boolean;
};

type LegacyInitialStatus = {
  shouldPlay?: boolean;
  volume?: number;
  isMuted?: boolean;
  rate?: number;
  shouldCorrectPitch?: boolean;
  positionMillis?: number;
  isLooping?: boolean;
};

export type PlaybackStatus = {
  isLoaded: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  rate: number;
  shouldCorrectPitch: boolean;
  positionMillis: number;
  durationMillis: number;
  isLooping: boolean;
  isBuffering: boolean;
  didJustFinish: boolean;
  hasJustBeenInterrupted: boolean;
  playableDurationMillis?: number;
  androidImplementation?: 'MediaPlayer' | 'ExoPlayer';
  error?: string;
};

const DEFAULT_STATUS: PlaybackStatus = {
  isLoaded: false,
  isPlaying: false,
  isMuted: false,
  volume: 1,
  rate: 1,
  shouldCorrectPitch: true,
  positionMillis: 0,
  durationMillis: 0,
  isLooping: false,
  isBuffering: false,
  didJustFinish: false,
  hasJustBeenInterrupted: false,
};

function mapAudioMode(mode: LegacyAudioMode): Partial<AudioMode> {
  const mapped: Partial<AudioMode> = {};

  if (mode.allowsRecordingIOS !== undefined) {
    mapped.allowsRecording = mode.allowsRecordingIOS;
  }
  if (mode.playsInSilentModeIOS !== undefined) {
    mapped.playsInSilentMode = mode.playsInSilentModeIOS;
  }
  if (mode.staysActiveInBackground !== undefined) {
    mapped.shouldPlayInBackground = mode.staysActiveInBackground;
  }
  if (mode.playThroughEarpieceAndroid !== undefined) {
    mapped.shouldRouteThroughEarpiece = mode.playThroughEarpieceAndroid;
  }

  const iosMode = mode.interruptionModeIOS ?? InterruptionModeIOS.MixWithOthers;
  mapped.interruptionMode = iosMode;

  let androidMode: LegacyInterruptionModeAndroid | undefined =
    mode.interruptionModeAndroid;
  if (!androidMode) {
    if (mode.shouldDuckAndroid === undefined) {
      androidMode = InterruptionModeAndroid.DoNotMix;
    } else {
      androidMode = mode.shouldDuckAndroid
        ? InterruptionModeAndroid.DuckOthers
        : InterruptionModeAndroid.DoNotMix;
    }
  }
  mapped.interruptionModeAndroid = androidMode;

  return mapped;
}

function toPlaybackStatus(status: AudioStatus, sound: Sound): PlaybackStatus {
  const durationMillis = Number.isFinite(status.duration)
    ? Math.max(0, status.duration * 1000)
    : 0;
  const positionMillis = Number.isFinite(status.currentTime)
    ? Math.max(0, status.currentTime * 1000)
    : 0;

  return {
    ...DEFAULT_STATUS,
    isLoaded: status.isLoaded,
    isPlaying: status.playing,
    isMuted: status.mute,
    volume: sound.getVolume(),
    rate: status.playbackRate ?? 1,
    shouldCorrectPitch: status.shouldCorrectPitch ?? true,
    positionMillis,
    durationMillis,
    isLooping: sound.getIsLooping(),
    isBuffering: status.isBuffering ?? false,
    didJustFinish: status.didJustFinish ?? false,
    hasJustBeenInterrupted: status.reasonForWaitingToPlay === 'interruption',
    playableDurationMillis: durationMillis,
    androidImplementation: 'ExoPlayer',
  };
}

export class Sound {
  private player: ReturnType<typeof createAudioPlayer>;
  private subscription: EventSubscription | null = null;
  private playbackCallback: ((status: PlaybackStatus) => void) | null = null;
  private lastStatus: PlaybackStatus = { ...DEFAULT_STATUS };
  private loadedResolver: (() => void) | null = null;
  private loadedPromise: Promise<void>;
  private unloaded = false;

  private constructor(player: ReturnType<typeof createAudioPlayer>) {
    this.player = player;
    this.loadedPromise = new Promise(resolve => {
      this.loadedResolver = resolve;
    });

    if (this.player.isLoaded) {
      this.resolveLoaded();
    }

    this.subscription = this.player.addListener(
      PLAYBACK_STATUS_UPDATE,
      (status: AudioStatus) => {
        this.lastStatus = toPlaybackStatus(status, this);
        if (this.lastStatus.isLoaded) {
          this.resolveLoaded();
        }
        this.playbackCallback?.(this.lastStatus);
      }
    );
  }

  static async createAsync(
    source: AudioSource,
    initialStatus: LegacyInitialStatus = {}
  ) {
    const player = createAudioPlayer(source, 250);
    const sound = new Sound(player);
    await sound.waitForLoaded();
    await sound.applyInitialStatus(initialStatus);
    const status = await sound.getStatusAsync();
    return { sound, status };
  }

  private resolveLoaded() {
    if (this.loadedResolver) {
      this.loadedResolver();
      this.loadedResolver = null;
    }
  }

  private async waitForLoaded(timeoutMs: number = 5000) {
    if (this.lastStatus.isLoaded || this.player.isLoaded) {
      return;
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    await Promise.race([
      this.loadedPromise,
      new Promise<void>(resolve => {
        timeoutHandle = setTimeout(resolve, timeoutMs);
      }),
    ]);

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }

  private ensureActive() {
    if (this.unloaded) {
      throw new Error('Cannot use a Sound that has been unloaded');
    }
  }

  private async applyInitialStatus(status: LegacyInitialStatus) {
    if (status.volume !== undefined) {
      await this.setVolumeAsync(status.volume);
    }
    if (status.isMuted !== undefined) {
      await this.setIsMutedAsync(status.isMuted);
    }
    if (status.rate !== undefined) {
      await this.setRateAsync(status.rate, status.shouldCorrectPitch ?? true);
    }
    if (status.positionMillis !== undefined) {
      await this.setPositionAsync(status.positionMillis);
    }
    if (status.isLooping !== undefined) {
      this.player.loop = status.isLooping;
      this.lastStatus = {
        ...this.lastStatus,
        isLooping: status.isLooping,
      };
    }
    if (status.shouldPlay) {
      await this.playAsync();
    }
  }

  setOnPlaybackStatusUpdate(callback?: (status: PlaybackStatus) => void) {
    this.ensureActive();
    this.playbackCallback = callback ?? null;
    if (callback && this.lastStatus.isLoaded) {
      callback(this.lastStatus);
    }
  }

  async getStatusAsync(): Promise<PlaybackStatus> {
    this.ensureActive();
    const nativeStatus = this.player.currentStatus;
    this.lastStatus = toPlaybackStatus(nativeStatus, this);
    return this.lastStatus;
  }

  async playAsync(): Promise<PlaybackStatus> {
    this.ensureActive();
    this.player.play();
    return this.getStatusAsync();
  }

  async pauseAsync(): Promise<PlaybackStatus> {
    this.ensureActive();
    this.player.pause();
    return this.getStatusAsync();
  }

  async stopAsync(): Promise<PlaybackStatus> {
    this.ensureActive();
    this.player.pause();
    await this.player.seekTo(0);
    return this.getStatusAsync();
  }

  async unloadAsync(): Promise<void> {
    if (this.unloaded) {
      return;
    }
    this.subscription?.remove();
    this.subscription = null;
    this.player.remove();
    this.unloaded = true;
  }

  async setVolumeAsync(volume: number): Promise<PlaybackStatus> {
    this.ensureActive();
    this.player.volume = Math.max(0, Math.min(1, volume));
    this.lastStatus = {
      ...this.lastStatus,
      volume: this.player.volume,
      isMuted: this.player.muted,
    };
    return this.lastStatus;
  }

  async setIsMutedAsync(isMuted: boolean): Promise<PlaybackStatus> {
    this.ensureActive();
    this.player.muted = isMuted;
    this.lastStatus = {
      ...this.lastStatus,
      isMuted,
      volume: isMuted ? 0 : this.lastStatus.volume,
    };
    return this.lastStatus;
  }

  async setRateAsync(
    rate: number,
    shouldCorrectPitch: boolean,
    pitchCorrectionQuality?: PitchCorrectionQuality
  ): Promise<PlaybackStatus> {
    this.ensureActive();
    const correctionQuality =
      pitchCorrectionQuality ?? (shouldCorrectPitch ? 'high' : 'low');
    this.player.setPlaybackRate(rate, correctionQuality);
    this.lastStatus = {
      ...this.lastStatus,
      rate,
      shouldCorrectPitch,
    };
    return this.lastStatus;
  }

  async setPositionAsync(positionMillis: number): Promise<PlaybackStatus> {
    this.ensureActive();
    const seconds = Math.max(0, positionMillis) / 1000;
    await this.player.seekTo(seconds);
    this.lastStatus = {
      ...this.lastStatus,
      positionMillis: Math.floor(seconds * 1000),
    };
    return this.lastStatus;
  }

  getVolume(): number {
    return this.player.volume ?? this.lastStatus.volume;
  }

  getIsLooping(): boolean {
    return this.player.loop ?? this.lastStatus.isLooping;
  }
}

async function setAudioModeAsync(mode: LegacyAudioMode) {
  return expoSetAudioModeAsync(mapAudioMode(mode));
}

export const InterruptionModeIOS = {
  MixWithOthers: 'mixWithOthers',
  DoNotMix: 'doNotMix',
  DuckOthers: 'duckOthers',
} as const;

export const InterruptionModeAndroid = {
  DoNotMix: 'doNotMix',
  DuckOthers: 'duckOthers',
} as const;

export const Audio = {
  Sound,
  setAudioModeAsync,
  setIsAudioActiveAsync: expoSetIsAudioActiveAsync,
  requestRecordingPermissionsAsync: expoRequestRecordingPermissionsAsync,
  getRecordingPermissionsAsync: expoGetRecordingPermissionsAsync,
};

export type { LegacyAudioMode as AudioModeLegacy };
export type AudioSoundInstance = Sound;
