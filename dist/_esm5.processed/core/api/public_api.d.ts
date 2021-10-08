/**
 * Copyright 2015 CANAL+ Group
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ICustomError, IErrorCode, IErrorType } from "../../errors";
import Manifest, { Adaptation, Period, Representation } from "../../manifest";
import { IBifThumbnail } from "../../parsers/images/bif";
import EventEmitter from "../../utils/event_emitter";
import Logger from "../../utils/logger";
import { IStreamEventData } from "../init/stream_events_emitter";
import { IBufferedChunk, IBufferType } from "../segment_buffers";
import { IInbandEvent } from "../stream";
import { IPlayerState } from "./get_player_state";
import { IConstructorOptions, ILoadVideoOptions } from "./option_utils";
import { IAudioTrackPreference, ITextTrackPreference, ITMAudioTrack, ITMAudioTrackListItem, ITMTextTrack, ITMTextTrackListItem, ITMVideoTrack, ITMVideoTrackListItem, IVideoTrackPreference } from "./track_choice_manager";
/** Payload emitted with a `positionUpdate` event. */
interface IPositionUpdateItem {
    /** current position the player is in, in seconds. */
    position: number;
    /** Last position set for the current media currently, in seconds. */
    duration: number;
    /** Playback rate (i.e. speed) at which the current media is played. */
    playbackRate: number;
    /** Amount of buffer available for now in front of the current position, in seconds. */
    bufferGap: number;
    /** Current maximum seekable position. */
    maximumBufferTime?: number;
    wallClockTime?: number;
    /**
     * Only for live contents. Difference between the "live edge" and the current
     * position, in seconds.
     */
    liveGap?: number;
}
/** Payload emitted with a `bitrateEstimationChange` event. */
interface IBitrateEstimate {
    /** The type of buffer this estimate was done for (e.g. "audio). */
    type: IBufferType;
    /** The calculated bitrate, in bits per seconds. */
    bitrate: number | undefined;
}
export declare type IStreamEvent = {
    data: IStreamEventData;
    start: number;
    end: number;
    onExit?: () => void;
} | {
    data: IStreamEventData;
    start: number;
};
/** Every events sent by the RxPlayer's public API. */
interface IPublicAPIEvent {
    playerStateChange: string;
    positionUpdate: IPositionUpdateItem;
    audioTrackChange: ITMAudioTrack | null;
    textTrackChange: ITMTextTrack | null;
    videoTrackChange: ITMVideoTrack | null;
    audioBitrateChange: number;
    videoBitrateChange: number;
    imageTrackUpdate: {
        data: IBifThumbnail[];
    };
    fullscreenChange: boolean;
    bitrateEstimationChange: IBitrateEstimate;
    volumeChange: number;
    error: ICustomError | Error;
    warning: ICustomError | Error;
    nativeTextTracksChange: TextTrack[];
    periodChange: Period;
    availableAudioBitratesChange: number[];
    availableVideoBitratesChange: number[];
    availableAudioTracksChange: ITMAudioTrackListItem[];
    availableTextTracksChange: ITMTextTrackListItem[];
    availableVideoTracksChange: ITMVideoTrackListItem[];
    decipherabilityUpdate: Array<{
        manifest: Manifest;
        period: Period;
        adaptation: Adaptation;
        representation: Representation;
    }>;
    seeking: null;
    seeked: null;
    streamEvent: IStreamEvent;
    streamEventSkip: IStreamEvent;
    inbandEvents: IInbandEvent[];
}
/**
 * @class Player
 * @extends EventEmitter
 */
declare class Player extends EventEmitter<IPublicAPIEvent> {
    /** Current version of the RxPlayer.  */
    static version: string;
    /** Current version of the RxPlayer.  */
    readonly version: string;
    /** Media element attached to the RxPlayer.  */
    videoElement: HTMLMediaElement | null;
    /** Logger the RxPlayer uses.  */
    readonly log: Logger;
    /**
     * Current state of the RxPlayer.
     * Please use `getPlayerState()` instead.
     */
    state: IPlayerState;
    /**
     * Emit when the the RxPlayer is not needed anymore and thus all resources
     * used for its normal functionment can be freed.
     * The player will be unusable after that.
     */
    private readonly _priv_destroy$;
    /**
     * Contains `true` when the previous content is cleaning-up, `false` when it's
     * done.
     * A new content cannot be launched until it stores `false`.
     */
    private readonly _priv_contentLock;
    /**
     * Changes on "play" and "pause" events from the media elements.
     * Switches to ``true`` whent the "play" event was the last received.
     * Switches to ``false`` whent the "pause" event was the last received.
     * ``false`` if no such event was received for the current loaded content.
     */
    private readonly _priv_isPlaying;
    /**
     * The speed that should be applied to playback.
     * Used instead of videoElement.playbackRate to allow more flexibility.
     */
    private readonly _priv_speed;
    /** Store buffer-related options used needed when initializing a content. */
    private readonly _priv_bufferOptions;
    /** Information on the current bitrate settings. */
    private readonly _priv_bitrateInfos;
    /**
     * Current fatal error which STOPPED the player.
     * `null` if no fatal error was received for the current or last content.
     */
    private _priv_currentError;
    /**
     * Information about the current content being played.
     * `null` when no content is currently loading or loaded.
     */
    private _priv_contentInfos;
    /** List of favorite audio tracks, in preference order.  */
    private _priv_preferredAudioTracks;
    /** List of favorite text tracks, in preference order.  */
    private _priv_preferredTextTracks;
    /** List of favorite video tracks, in preference order. */
    private _priv_preferredVideoTracks;
    /** If `true` trickMode video tracks will be chosen if available. */
    private _priv_preferTrickModeTracks;
    /**
     * TrackChoiceManager instance linked to the current content.
     * `null` if no content has been loaded or if the current content loaded
     * has no TrackChoiceManager.
     */
    private _priv_trackChoiceManager;
    /**
     * MediaElementTrackChoiceManager instance linked to the current content.
     * `null` if no content has been loaded or if the current content loaded
     * has no MediaElementTrackChoiceManager.
     */
    private _priv_mediaElementTrackChoiceManager;
    /** Emit last picture in picture event. */
    private _priv_pictureInPictureEvent$;
    /** Store wanted configuration for the `limitVideoWidth` option. */
    private readonly _priv_limitVideoWidth;
    /** Store wanted configuration for the `throttleWhenHidden` option. */
    private readonly _priv_throttleWhenHidden;
    /** Store wanted configuration for the `throttleVideoBitrateWhenHidden` option. */
    private readonly _priv_throttleVideoBitrateWhenHidden;
    /** Store volume when mute is called, to restore it on unmute. */
    private _priv_mutedMemory;
    /**
     * Store last state of various values sent as events, to avoid re-triggering
     * them multiple times in a row.
     *
     * All those events are linked to the content being played and can be cleaned
     * on stop.
     */
    private _priv_contentEventsMemory;
    /** Determines whether or not the player should stop at the end of video playback. */
    private readonly _priv_stopAtEnd;
    /** Information about last content being played. */
    private _priv_lastContentPlaybackInfos;
    /** All possible Error types emitted by the RxPlayer. */
    static get ErrorTypes(): Record<IErrorType, IErrorType>;
    /** All possible Error codes emitted by the RxPlayer. */
    static get ErrorCodes(): Record<IErrorCode, IErrorCode>;
    /**
     * Current log level.
     * Update current log level.
     * Should be either (by verbosity ascending):
     *   - "NONE"
     *   - "ERROR"
     *   - "WARNING"
     *   - "INFO"
     *   - "DEBUG"
     * Any other value will be translated to "NONE".
     */
    static get LogLevel(): string;
    static set LogLevel(logLevel: string);
    /**
     * @constructor
     * @param {Object} options
     */
    constructor(options?: IConstructorOptions);
    /**
     * Stop the playback for the current content.
     */
    stop(): void;
    /**
     * Free the resources used by the player.
     * /!\ The player cannot be "used" anymore after this method has been called.
     */
    dispose(): void;
    /**
     * Load a new video.
     * @param {Object} opts
     */
    loadVideo(opts: ILoadVideoOptions): void;
    /**
     * Reload last content. Init media playback without fetching again
     * the manifest.
     * @param {Object} reloadOpts
     */
    reload(reloadOpts?: {
        reloadAt?: {
            position?: number;
            relative?: number;
        };
    }): void;
    /**
     * From given options, initialize content playback.
     * @param {Object} options
     */
    private _priv_initializeContentPlayback;
    /**
     * Returns fatal error if one for the current content.
     * null otherwise.
     * @returns {Object|null} - The current Error (`null` when no error).
     */
    getError(): Error | null;
    /**
     * Returns manifest/playlist object.
     * null if the player is STOPPED.
     * @deprecated
     * @returns {Manifest|null} - The current Manifest (`null` when not known).
     */
    getManifest(): Manifest | null;
    /**
     * Returns Adaptations (tracks) for every currently playing type
     * (audio/video/text...).
     * @deprecated
     * @returns {Object|null} - The current Adaptation objects, per type (`null`
     * when none is known for now.
     */
    getCurrentAdaptations(): Partial<Record<IBufferType, Adaptation | null>> | null;
    /**
     * Returns representations (qualities) for every currently playing type
     * (audio/video/text...).
     * @deprecated
     * @returns {Object|null} - The current Representation objects, per type
     * (`null` when none is known for now.
     */
    getCurrentRepresentations(): Partial<Record<IBufferType, Representation | null>> | null;
    /**
     * Returns the media DOM element used by the player.
     * You should not its HTML5 API directly and use the player's method instead,
     * to ensure a well-behaved player.
     * @returns {HTMLMediaElement|null} - The HTMLMediaElement used (`null` when
     * disposed)
     */
    getVideoElement(): HTMLMediaElement | null;
    /**
     * If one returns the first native text-track element attached to the media element.
     * @deprecated
     * @returns {TextTrack} - The native TextTrack attached (`null` when none)
     */
    getNativeTextTrack(): TextTrack | null;
    /**
     * Returns the player's current state.
     * @returns {string} - The current Player's state
     */
    getPlayerState(): string;
    /**
     * Returns true if both:
     *   - a content is loaded
     *   - the content loaded is a live content
     * @returns {Boolean} - `true` if we're playing a live content, `false` otherwise.
     */
    isLive(): boolean;
    /**
     * Returns `true` if trickmode playback is active (usually through the usage
     * of the `setPlaybackRate` method), which means that the RxPlayer selects
     * "trickmode" video tracks in priority.
     * @returns {Boolean}
     */
    areTrickModeTracksEnabled(): boolean;
    /**
     * Returns the url of the content's manifest
     * @returns {string|undefined} - Current URL. `undefined` if not known or no
     * URL yet.
     */
    getUrl(): string | undefined;
    /**
     * Returns the video duration, in seconds.
     * NaN if no video is playing.
     * @returns {Number}
     */
    getVideoDuration(): number;
    /**
     * Returns in seconds the difference between:
     *   - the end of the current contiguous loaded range.
     *   - the current time
     * @returns {Number}
     */
    getVideoBufferGap(): number;
    /**
     * Returns in seconds the difference between:
     *   - the end of the current contiguous loaded range.
     *   - the start of the current contiguous loaded range.
     * @returns {Number}
     */
    getVideoLoadedTime(): number;
    /**
     * Returns in seconds the difference between:
     *   - the current time.
     *   - the start of the current contiguous loaded range.
     * @returns {Number}
     */
    getVideoPlayedTime(): number;
    /**
     * Get the current position, in s, in wall-clock time.
     * That is:
     *   - for live content, get a timestamp, in s, of the current played content.
     *   - for static content, returns the position from beginning in s.
     *
     * If you do not know if you want to use this method or getPosition:
     *   - If what you want is to display the current time to the user, use this
     *     one.
     *   - If what you want is to interact with the player's API or perform other
     *     actions (like statistics) with the real player data, use getPosition.
     *
     * @returns {Number}
     */
    getWallClockTime(): number;
    /**
     * Get the current position, in seconds, of the video element.
     *
     * If you do not know if you want to use this method or getWallClockTime:
     *   - If what you want is to display the current time to the user, use
     *     getWallClockTime.
     *   - If what you want is to interact with the player's API or perform other
     *     actions (like statistics) with the real player data, use this one.
     *
     * @returns {Number}
     */
    getPosition(): number;
    /**
     * Returns the current playback rate at which the video plays.
     * @returns {Number}
     */
    getPlaybackRate(): number;
    /**
     * Update the playback rate of the video.
     *
     * This method's effect is persisted from content to content, and can be
     * called even when no content is playing (it will still have an effect for
     * the next contents).
     *
     * If you want to reverse effects provoked by `setPlaybackRate` before playing
     * another content, you will have to call `setPlaybackRate` first with the
     * default settings you want to set.
     *
     * As an example, to reset the speed to "normal" (x1) speed and to disable
     * trickMode video tracks (which may have been enabled by a previous
     * `setPlaybackRate` call), you can call:
     * ```js
     * player.setPlaybackRate(1, { preferTrickModeTracks: false });
     * ```
     *
     * --
     *
     * This method can be used to switch to or exit from "trickMode" video tracks,
     * which are tracks specifically defined to mimic the visual aspect of a VCR's
     * fast forward/rewind feature, by only displaying a few video frames during
     * playback.
     *
     * This behavior is configurable through the second argument, by adding a
     * property named `preferTrickModeTracks` to that object.
     *
     * You can set that value to `true` to switch to trickMode video tracks when
     * available, and set it to `false` when you want to disable that logic.
     * Note that like any configuration given to `setPlaybackRate`, this setting
     * is persisted through all future contents played by the player.
     *
     * If you want to stop enabling trickMode tracks, you will have to call
     * `setPlaybackRate` again with `preferTrickModeTracks` set to `false`.
     *
     * You can know at any moment whether this behavior is enabled by calling
     * the `areTrickModeTracksEnabled` method. This will only means that the
     * RxPlayer will select in priority trickmode video tracks, not that the
     * currently chosen video tracks is a trickmode track (for example, some
     * contents may have no trickmode tracks available).
     *
     * If you want to know about the latter instead, you can call `getVideoTrack`
     * and/or listen to `videoTrackChange` events. The track returned may have an
     * `isTrickModeTrack` property set to `true`, indicating that it is a
     * trickmode track.
     *
     * Note that switching to or getting out of a trickmode video track may
     * lead to the player being a brief instant in a `"RELOADING"` state (notified
     * through `playerStateChange` events and the `getPlayerState` method). When in
     * that state, a black screen may be displayed and multiple RxPlayer APIs will
     * not be usable.
     *
     * @param {Number} rate
     * @param {Object} opts
     */
    setPlaybackRate(rate: number, opts?: {
        preferTrickModeTracks?: boolean;
    }): void;
    /**
     * Returns all available bitrates for the current video Adaptation.
     * @returns {Array.<Number>}
     */
    getAvailableVideoBitrates(): number[];
    /**
     * Returns all available bitrates for the current audio Adaptation.
     * @returns {Array.<Number>}
     */
    getAvailableAudioBitrates(): number[];
    /**
     * Returns the manual audio bitrate set. -1 if in AUTO mode.
     * @returns {Number}
     */
    getManualAudioBitrate(): number;
    /**
     * Returns the manual video bitrate set. -1 if in AUTO mode.
     * @returns {Number}
     */
    getManualVideoBitrate(): number;
    /**
     * Returns currently considered bitrate for video segments.
     * @returns {Number|undefined}
     */
    getVideoBitrate(): number | undefined;
    /**
     * Returns currently considered bitrate for audio segments.
     * @returns {Number|undefined}
     */
    getAudioBitrate(): number | undefined;
    /**
     * Returns minimum wanted video bitrate currently set.
     * @returns {Number}
     */
    getMinVideoBitrate(): number;
    /**
     * Returns minimum wanted audio bitrate currently set.
     * @returns {Number}
     */
    getMinAudioBitrate(): number;
    /**
     * Returns maximum wanted video bitrate currently set.
     * @returns {Number}
     */
    getMaxVideoBitrate(): number;
    /**
     * Returns maximum wanted audio bitrate currently set.
     * @returns {Number}
     */
    getMaxAudioBitrate(): number;
    /**
     * Play/Resume the current video.
     * @returns {Promise}
     */
    play(): Promise<void>;
    /**
     * Pause the current video.
     */
    pause(): void;
    /**
     * Seek to a given absolute position.
     * @param {Number|Object} time
     * @returns {Number} - The time the player has seek to
     */
    seekTo(time: number | {
        relative: number;
    } | {
        position: number;
    } | {
        wallClockTime: number;
    }): number;
    /**
     * Returns true if the media element is full screen.
     * @deprecated
     * @returns {Boolean}
     */
    isFullscreen(): boolean;
    /**
     * Set/exit fullScreen.
     * @deprecated
     * @param {Boolean} [goFull=true] - if false, exit full screen.
     */
    setFullscreen(goFull?: boolean): void;
    /**
     * Exit from full screen mode.
     * @deprecated
     */
    exitFullscreen(): void;
    /**
     * Returns the current player's audio volume on the media element.
     * From 0 (no audio) to 1 (maximum volume).
     * @returns {Number}
     */
    getVolume(): number;
    /**
     * Set the player's audio volume. From 0 (no volume) to 1 (maximum volume).
     * @param {Number} volume
     */
    setVolume(volume: number): void;
    /**
     * Returns true if the volume is set to 0. false otherwise.
     * @returns {Boolean}
     */
    isMute(): boolean;
    /**
     * Set the volume to 0 and save current one for when unmuted.
     */
    mute(): void;
    /**
     * Set the volume back to when it was when mute was last called.
     * If the volume was set to 0, set a default volume instead (see config).
     */
    unMute(): void;
    /**
     * Force the video bitrate to a given value. Act as a ceil.
     * -1 to set it on AUTO Mode
     * @param {Number} btr
     */
    setVideoBitrate(btr: number): void;
    /**
     * Force the audio bitrate to a given value. Act as a ceil.
     * -1 to set it on AUTO Mode
     * @param {Number} btr
     */
    setAudioBitrate(btr: number): void;
    /**
     * Update the minimum video bitrate the user can switch to.
     * @param {Number} btr
     */
    setMinVideoBitrate(btr: number): void;
    /**
     * Update the minimum audio bitrate the user can switch to.
     * @param {Number} btr
     */
    setMinAudioBitrate(btr: number): void;
    /**
     * Update the maximum video bitrate the user can switch to.
     * @param {Number} btr
     */
    setMaxVideoBitrate(btr: number): void;
    /**
     * Update the maximum audio bitrate the user can switch to.
     * @param {Number} btr
     */
    setMaxAudioBitrate(btr: number): void;
    /**
     * Set the max buffer size for the buffer behind the current position.
     * Every buffer data before will be removed.
     * @param {Number} depthInSeconds
     */
    setMaxBufferBehind(depthInSeconds: number): void;
    /**
     * Set the max buffer size for the buffer behind the current position.
     * Every buffer data before will be removed.
     * @param {Number} depthInSeconds
     */
    setMaxBufferAhead(depthInSeconds: number): void;
    /**
     * Set the max buffer size for the buffer ahead of the current position.
     * The player will stop downloading chunks when this size is reached.
     * @param {Number} sizeInSeconds
     */
    setWantedBufferAhead(sizeInSeconds: number): void;
    /**
     * Returns the max buffer size for the buffer behind the current position.
     * @returns {Number}
     */
    getMaxBufferBehind(): number;
    /**
     * Returns the max buffer size for the buffer behind the current position.
     * @returns {Number}
     */
    getMaxBufferAhead(): number;
    /**
     * Returns the max buffer size for the buffer ahead of the current position.
     * @returns {Number}
     */
    getWantedBufferAhead(): number;
    /**
     * Returns type of current keysystem (e.g. playready, widevine) if the content
     * is encrypted. null otherwise.
     * @returns {string|null}
     */
    getCurrentKeySystem(): string | null;
    /**
     * Returns every available audio tracks for the current Period.
     * @returns {Array.<Object>|null}
     */
    getAvailableAudioTracks(): ITMAudioTrackListItem[];
    /**
     * Returns every available text tracks for the current Period.
     * @returns {Array.<Object>|null}
     */
    getAvailableTextTracks(): ITMTextTrackListItem[];
    /**
     * Returns every available video tracks for the current Period.
     * @returns {Array.<Object>|null}
     */
    getAvailableVideoTracks(): ITMVideoTrackListItem[];
    /**
     * Returns currently chosen audio language for the current Period.
     * @returns {string}
     */
    getAudioTrack(): ITMAudioTrack | null | undefined;
    /**
     * Returns currently chosen subtitle for the current Period.
     * @returns {string}
     */
    getTextTrack(): ITMTextTrack | null | undefined;
    /**
     * Returns currently chosen video track for the current Period.
     * @returns {string}
     */
    getVideoTrack(): ITMVideoTrack | null | undefined;
    /**
     * Update the audio language for the current Period.
     * @param {string} audioId
     * @throws Error - the current content has no TrackChoiceManager.
     * @throws Error - the given id is linked to no audio track.
     */
    setAudioTrack(audioId: string): void;
    /**
     * Update the text language for the current Period.
     * @param {string} sub
     * @throws Error - the current content has no TrackChoiceManager.
     * @throws Error - the given id is linked to no text track.
     */
    setTextTrack(textId: string): void;
    /**
     * Disable subtitles for the current content.
     */
    disableTextTrack(): void;
    /**
     * Update the video track for the current Period.
     * @param {string} videoId
     * @throws Error - the current content has no TrackChoiceManager.
     * @throws Error - the given id is linked to no video track.
     */
    setVideoTrack(videoId: string): void;
    /**
     * Disable video track for the current content.
     */
    disableVideoTrack(): void;
    /**
     * Returns the current list of preferred audio tracks, in preference order.
     * @returns {Array.<Object>}
     */
    getPreferredAudioTracks(): IAudioTrackPreference[];
    /**
     * Returns the current list of preferred text tracks, in preference order.
     * @returns {Array.<Object>}
     */
    getPreferredTextTracks(): ITextTrackPreference[];
    /**
     * Returns the current list of preferred text tracks, in preference order.
     * @returns {Array.<Object>}
     */
    getPreferredVideoTracks(): IVideoTrackPreference[];
    /**
     * Set the list of preferred audio tracks, in preference order.
     * @param {Array.<Object>} tracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Period. `false` if it should only
     * be applied to new content.
     */
    setPreferredAudioTracks(tracks: IAudioTrackPreference[], shouldApply?: boolean): void;
    /**
     * Set the list of preferred text tracks, in preference order.
     * @param {Array.<Object>} tracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Periods. `false` if it should only
     * be applied to new content.
     */
    setPreferredTextTracks(tracks: ITextTrackPreference[], shouldApply?: boolean): void;
    /**
     * Set the list of preferred text tracks, in preference order.
     * @param {Array.<Object>} tracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Period. `false` if it should only
     * be applied to new content.
     */
    setPreferredVideoTracks(tracks: IVideoTrackPreference[], shouldApply?: boolean): void;
    /**
     * @returns {Array.<Object>|null}
     * @deprecated
     */
    getImageTrackData(): IBifThumbnail[] | null;
    /**
     * Get minimum seek-able position.
     * @returns {number}
     */
    getMinimumPosition(): number | null;
    /**
     * Get maximum seek-able position.
     * @returns {number}
     */
    getMaximumPosition(): number | null;
    /**
     * /!\ For demo use only! Do not touch!
     *
     * Returns every chunk buffered for a given buffer type.
     * Returns `null` if no SegmentBuffer was created for this type of buffer.
     * @param {string} bufferType
     * @returns {Array.<Object>|null}
     */
    __priv_getSegmentBufferContent(bufferType: IBufferType): IBufferedChunk[] | null;
    /**
     * Reset all state properties relative to a playing content.
     */
    private _priv_cleanUpCurrentContentState;
    /**
     * Triggered each time the playback Observable emits.
     *
     * React to various events.
     *
     * @param {Object} event - payload emitted
     */
    private _priv_onPlaybackEvent;
    /**
     * Triggered when we received a fatal error.
     * Clean-up ressources and signal that the content has stopped on error.
     * @param {Error} error
     */
    private _priv_onPlaybackError;
    /**
     * Triggered when the playback Observable completes.
     * Clean-up ressources and signal that the content has ended.
     */
    private _priv_onPlaybackFinished;
    /**
     * Triggered when we received a warning event during playback.
     * Trigger the right API event.
     * @param {Error} error
     */
    private _priv_onPlaybackWarning;
    /**
     * Triggered when the Manifest has been loaded for the current content.
     * Initialize various private properties and emit initial event.
     * @param {Object} value
     */
    private _priv_onManifestReady;
    /**
     * Triggered each times the current Period Changed.
     * Store and emit initial state for the Period.
     *
     * @param {Object} value
     */
    private _priv_onActivePeriodChanged;
    /**
     * Triggered each times a new "PeriodStream" is ready.
     * Choose the right Adaptation for the Period and emit it.
     * @param {Object} value
     */
    private _priv_onPeriodStreamReady;
    /**
     * Triggered each times we "remove" a PeriodStream.
     * @param {Object} value
     */
    private _priv_onPeriodStreamCleared;
    /**
     * Triggered each time the content is re-loaded on the MediaSource.
     */
    private _priv_onReloadingMediaSource;
    /**
     * Triggered each times a new Adaptation is considered for the current
     * content.
     * Store given Adaptation and emit it if from the current Period.
     * @param {Object} value
     */
    private _priv_onAdaptationChange;
    /**
     * Triggered each times a new Representation is considered during playback.
     *
     * Store given Representation and emit it if from the current Period.
     *
     * @param {Object} obj
     */
    private _priv_onRepresentationChange;
    /**
     * Triggered each time a bitrate estimate is calculated.
     *
     * Emit it.
     *
     * @param {Object} value
     */
    private _priv_onBitrateEstimationChange;
    /**
     * Triggered each time the videoElement alternates between play and pause.
     *
     * Emit the info through the right Subject.
     *
     * @param {Boolean} isPlaying
     */
    private _priv_onPlayPauseNext;
    /**
     * Triggered each time a textTrack is added to the video DOM Element.
     *
     * Trigger the right Player Event.
     *
     * @param {Array.<TextTrackElement>} tracks
     */
    private _priv_onNativeTextTracksNext;
    /**
     * Triggered each time the player state updates.
     *
     * Trigger the right Player Event.
     *
     * @param {string} newState
     */
    private _priv_setPlayerState;
    /**
     * Triggered each time a new clock tick object is emitted.
     *
     * Trigger the right Player Event
     *
     * @param {Object} clockTick
     */
    private _priv_triggerPositionUpdate;
    /**
     * Trigger one of the "availableBitratesChange" event only if it changed from
     * the previously stored value.
     * @param {string} event
     * @param {Array.<number>} newVal
     */
    private _priv_triggerAvailableBitratesChangeEvent;
    /**
     * Trigger one of the "bitrateChange" event only if it changed from the
     * previously stored value.
     * @param {string} event
     * @param {number} newVal
     */
    private _priv_triggerCurrentBitrateChangeEvent;
    private _priv_getCurrentRepresentations;
}
export default Player;
export { IStreamEventData };
