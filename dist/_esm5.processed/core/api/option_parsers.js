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
/**
 * This file exports various helpers to parse options given to various APIs,
 * throw if something is wrong, and return a normalized option object.
 */
import config from "../../config";
import log from "../../log";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import { normalizeAudioTrack, normalizeTextTrack, } from "../../utils/languages";
import objectAssign from "../../utils/object_assign";
import warnOnce from "../../utils/warn_once";
var DEFAULT_AUTO_PLAY = config.DEFAULT_AUTO_PLAY, DEFAULT_INITIAL_BITRATES = config.DEFAULT_INITIAL_BITRATES, DEFAULT_LIMIT_VIDEO_WIDTH = config.DEFAULT_LIMIT_VIDEO_WIDTH, DEFAULT_MANUAL_BITRATE_SWITCHING_MODE = config.DEFAULT_MANUAL_BITRATE_SWITCHING_MODE, DEFAULT_MAX_BITRATES = config.DEFAULT_MAX_BITRATES, DEFAULT_MAX_BUFFER_AHEAD = config.DEFAULT_MAX_BUFFER_AHEAD, DEFAULT_MAX_BUFFER_BEHIND = config.DEFAULT_MAX_BUFFER_BEHIND, DEFAULT_SHOW_NATIVE_SUBTITLE = config.DEFAULT_SHOW_NATIVE_SUBTITLE, DEFAULT_STOP_AT_END = config.DEFAULT_STOP_AT_END, DEFAULT_TEXT_TRACK_MODE = config.DEFAULT_TEXT_TRACK_MODE, DEFAULT_THROTTLE_WHEN_HIDDEN = config.DEFAULT_THROTTLE_WHEN_HIDDEN, DEFAULT_THROTTLE_VIDEO_BITRATE_WHEN_HIDDEN = config.DEFAULT_THROTTLE_VIDEO_BITRATE_WHEN_HIDDEN, DEFAULT_WANTED_BUFFER_AHEAD = config.DEFAULT_WANTED_BUFFER_AHEAD;
/**
 * Parse options given to the API constructor and set default options as found
 * in the config.
 *
 * Do not mutate anything, only cross the given options and sane default options
 * (most coming from the config).
 * @param {Object|undefined} options
 * @returns {Object}
 */
function parseConstructorOptions(options) {
    var maxBufferAhead;
    var maxBufferBehind;
    var wantedBufferAhead;
    var limitVideoWidth;
    var throttleWhenHidden;
    var throttleVideoBitrateWhenHidden;
    var preferredAudioTracks;
    var preferredTextTracks;
    var preferredVideoTracks;
    var videoElement;
    var initialVideoBitrate;
    var initialAudioBitrate;
    var maxAudioBitrate;
    var maxVideoBitrate;
    var stopAtEnd;
    if (isNullOrUndefined(options.maxBufferAhead)) {
        maxBufferAhead = DEFAULT_MAX_BUFFER_AHEAD;
    }
    else {
        maxBufferAhead = Number(options.maxBufferAhead);
        if (isNaN(maxBufferAhead)) {
            throw new Error("Invalid maxBufferAhead parameter. Should be a number.");
        }
    }
    if (isNullOrUndefined(options.maxBufferBehind)) {
        maxBufferBehind = DEFAULT_MAX_BUFFER_BEHIND;
    }
    else {
        maxBufferBehind = Number(options.maxBufferBehind);
        if (isNaN(maxBufferBehind)) {
            throw new Error("Invalid maxBufferBehind parameter. Should be a number.");
        }
    }
    if (isNullOrUndefined(options.wantedBufferAhead)) {
        wantedBufferAhead = DEFAULT_WANTED_BUFFER_AHEAD;
    }
    else {
        wantedBufferAhead = Number(options.wantedBufferAhead);
        if (isNaN(wantedBufferAhead)) {
            /* tslint:disable:max-line-length */
            throw new Error("Invalid wantedBufferAhead parameter. Should be a number.");
            /* tslint:enable:max-line-length */
        }
    }
    limitVideoWidth = isNullOrUndefined(options.limitVideoWidth) ?
        DEFAULT_LIMIT_VIDEO_WIDTH :
        !!options.limitVideoWidth;
    if (!isNullOrUndefined(options.throttleWhenHidden)) {
        warnOnce("`throttleWhenHidden` API is deprecated. Consider using " +
            "`throttleVideoBitrateWhenHidden` instead.");
        throttleWhenHidden = !!options.throttleWhenHidden;
    }
    else {
        throttleWhenHidden = DEFAULT_THROTTLE_WHEN_HIDDEN;
    }
    // `throttleWhenHidden` and `throttleVideoBitrateWhenHidden` can be in conflict
    // Do not activate the latter if the former is
    if (throttleWhenHidden) {
        throttleVideoBitrateWhenHidden = false;
    }
    else {
        throttleVideoBitrateWhenHidden =
            isNullOrUndefined(options.throttleVideoBitrateWhenHidden) ?
                DEFAULT_THROTTLE_VIDEO_BITRATE_WHEN_HIDDEN :
                !!options.throttleVideoBitrateWhenHidden;
    }
    if (options.preferredTextTracks !== undefined) {
        if (!Array.isArray(options.preferredTextTracks)) {
            warnOnce("Invalid `preferredTextTracks` option, it should be an Array");
            preferredTextTracks = [];
        }
        else {
            preferredTextTracks = options.preferredTextTracks;
        }
    }
    else {
        preferredTextTracks = [];
    }
    if (options.preferredAudioTracks !== undefined) {
        if (!Array.isArray(options.preferredAudioTracks)) {
            warnOnce("Invalid `preferredAudioTracks` option, it should be an Array");
            preferredAudioTracks = [];
        }
        else {
            preferredAudioTracks = options.preferredAudioTracks;
        }
    }
    else {
        preferredAudioTracks = [];
    }
    if (options.preferredVideoTracks !== undefined) {
        if (!Array.isArray(options.preferredVideoTracks)) {
            warnOnce("Invalid `preferredVideoTracks` option, it should be an Array");
            preferredVideoTracks = [];
        }
        else {
            preferredVideoTracks = options.preferredVideoTracks;
        }
    }
    else {
        preferredVideoTracks = [];
    }
    if (isNullOrUndefined(options.videoElement)) {
        videoElement = document.createElement("video");
    }
    else if (options.videoElement instanceof HTMLMediaElement) {
        videoElement = options.videoElement;
    }
    else {
        /* tslint:disable:max-line-length */
        throw new Error("Invalid videoElement parameter. Should be a HTMLMediaElement.");
        /* tslint:enable:max-line-length */
    }
    if (isNullOrUndefined(options.initialVideoBitrate)) {
        initialVideoBitrate = DEFAULT_INITIAL_BITRATES.video;
    }
    else {
        initialVideoBitrate = Number(options.initialVideoBitrate);
        if (isNaN(initialVideoBitrate)) {
            /* tslint:disable:max-line-length */
            throw new Error("Invalid initialVideoBitrate parameter. Should be a number.");
            /* tslint:enable:max-line-length */
        }
    }
    if (isNullOrUndefined(options.initialAudioBitrate)) {
        initialAudioBitrate = DEFAULT_INITIAL_BITRATES.audio;
    }
    else {
        initialAudioBitrate = Number(options.initialAudioBitrate);
        if (isNaN(initialAudioBitrate)) {
            /* tslint:disable:max-line-length */
            throw new Error("Invalid initialAudioBitrate parameter. Should be a number.");
            /* tslint:enable:max-line-length */
        }
    }
    if (isNullOrUndefined(options.maxVideoBitrate)) {
        maxVideoBitrate = DEFAULT_MAX_BITRATES.video;
    }
    else {
        maxVideoBitrate = Number(options.maxVideoBitrate);
        if (isNaN(maxVideoBitrate)) {
            throw new Error("Invalid maxVideoBitrate parameter. Should be a number.");
        }
    }
    if (isNullOrUndefined(options.maxAudioBitrate)) {
        maxAudioBitrate = DEFAULT_MAX_BITRATES.audio;
    }
    else {
        maxAudioBitrate = Number(options.maxAudioBitrate);
        if (isNaN(maxAudioBitrate)) {
            throw new Error("Invalid maxAudioBitrate parameter. Should be a number.");
        }
    }
    stopAtEnd = isNullOrUndefined(options.stopAtEnd) ? DEFAULT_STOP_AT_END :
        !!options.stopAtEnd;
    return { maxBufferAhead: maxBufferAhead,
        maxBufferBehind: maxBufferBehind,
        limitVideoWidth: limitVideoWidth,
        videoElement: videoElement,
        wantedBufferAhead: wantedBufferAhead,
        throttleWhenHidden: throttleWhenHidden,
        throttleVideoBitrateWhenHidden: throttleVideoBitrateWhenHidden,
        preferredAudioTracks: preferredAudioTracks,
        preferredTextTracks: preferredTextTracks,
        preferredVideoTracks: preferredVideoTracks,
        initialAudioBitrate: initialAudioBitrate,
        initialVideoBitrate: initialVideoBitrate,
        maxAudioBitrate: maxAudioBitrate,
        maxVideoBitrate: maxVideoBitrate,
        stopAtEnd: stopAtEnd };
}
/**
 * Parse options given to loadVideo and set default options as found
 * in the config.
 *
 * Do not mutate anything, only cross the given options and sane default options
 * (most coming from the config).
 *
 * Throws if any mandatory option is not set.
 * @param {Object|undefined} options
 * @param {Object} ctx - The player context, needed for some default values.
 * @returns {Object}
 */
function parseLoadVideoOptions(options) {
    var _a, _b, _c, _d, _e;
    var url;
    var transport;
    var keySystems;
    var textTrackMode;
    var textTrackElement;
    var startAt;
    if (isNullOrUndefined(options)) {
        throw new Error("No option set on loadVideo");
    }
    if (!isNullOrUndefined(options.url)) {
        url = String(options.url);
    }
    else if (isNullOrUndefined((_a = options.transportOptions) === null || _a === void 0 ? void 0 : _a.manifestLoader)) {
        throw new Error("No url set on loadVideo");
    }
    if (isNullOrUndefined(options.transport)) {
        throw new Error("No transport set on loadVideo");
    }
    else {
        transport = String(options.transport);
    }
    var autoPlay = isNullOrUndefined(options.autoPlay) ? DEFAULT_AUTO_PLAY :
        !!options.autoPlay;
    if (isNullOrUndefined(options.keySystems)) {
        keySystems = [];
    }
    else {
        keySystems = Array.isArray(options.keySystems) ? options.keySystems :
            [options.keySystems];
        for (var _i = 0, keySystems_1 = keySystems; _i < keySystems_1.length; _i++) {
            var keySystem = keySystems_1[_i];
            if (typeof keySystem.type !== "string" ||
                typeof keySystem.getLicense !== "function") {
                throw new Error("Invalid key system given: Missing type string or " +
                    "getLicense callback");
            }
        }
    }
    var lowLatencyMode = options.lowLatencyMode === undefined ?
        false :
        !!options.lowLatencyMode;
    var transportOptsArg = typeof options.transportOptions === "object" &&
        options.transportOptions !== null ?
        options.transportOptions :
        {};
    var manifestUpdateUrl = (_b = options.transportOptions) === null || _b === void 0 ? void 0 : _b.manifestUpdateUrl;
    var minimumManifestUpdateInterval = (_d = (_c = options.transportOptions) === null || _c === void 0 ? void 0 : _c.minimumManifestUpdateInterval) !== null && _d !== void 0 ? _d : 0;
    var transportOptions = objectAssign({}, transportOptsArg, {
        /* tslint:disable deprecation */
        supplementaryImageTracks: [],
        supplementaryTextTracks: [],
        /* tslint:enable deprecation */
        lowLatencyMode: lowLatencyMode,
    });
    // remove already parsed data to simplify the `transportOptions` object
    delete transportOptions.manifestUpdateUrl;
    delete transportOptions.minimumManifestUpdateInterval;
    if (options.supplementaryTextTracks !== undefined) {
        warnOnce("The `supplementaryTextTracks` loadVideo option is deprecated.\n" +
            "Please use the `TextTrackRenderer` tool instead.");
        var supplementaryTextTracks = Array.isArray(options.supplementaryTextTracks) ?
            options.supplementaryTextTracks : [options.supplementaryTextTracks];
        for (var _f = 0, supplementaryTextTracks_1 = supplementaryTextTracks; _f < supplementaryTextTracks_1.length; _f++) {
            var supplementaryTextTrack = supplementaryTextTracks_1[_f];
            if (typeof supplementaryTextTrack.language !== "string" ||
                typeof supplementaryTextTrack.mimeType !== "string" ||
                typeof supplementaryTextTrack.url !== "string") {
                throw new Error("Invalid supplementary text track given. " +
                    "Missing either language, mimetype or url");
            }
        }
        transportOptions.supplementaryTextTracks = supplementaryTextTracks;
    }
    if (options.supplementaryImageTracks !== undefined) {
        warnOnce("The `supplementaryImageTracks` loadVideo option is deprecated.\n" +
            "Please use the `parseBifThumbnails` tool instead.");
        var supplementaryImageTracks = Array.isArray(options.supplementaryImageTracks) ?
            options.supplementaryImageTracks : [options.supplementaryImageTracks];
        for (var _g = 0, supplementaryImageTracks_1 = supplementaryImageTracks; _g < supplementaryImageTracks_1.length; _g++) {
            var supplementaryImageTrack = supplementaryImageTracks_1[_g];
            if (typeof supplementaryImageTrack.mimeType !== "string" ||
                typeof supplementaryImageTrack.url !== "string") {
                throw new Error("Invalid supplementary image track given. " +
                    "Missing either mimetype or url");
            }
        }
        transportOptions.supplementaryImageTracks = supplementaryImageTracks;
    }
    if (isNullOrUndefined(options.textTrackMode)) {
        textTrackMode = DEFAULT_TEXT_TRACK_MODE;
    }
    else {
        if (options.textTrackMode !== "native" && options.textTrackMode !== "html") {
            throw new Error("Invalid textTrackMode.");
        }
        textTrackMode = options.textTrackMode;
    }
    if (!isNullOrUndefined(options.defaultAudioTrack)) {
        warnOnce("The `defaultAudioTrack` loadVideo option is deprecated.\n" +
            "Please use the `preferredAudioTracks` constructor option or the" +
            "`setPreferredAudioTracks` method instead");
    }
    var defaultAudioTrack = normalizeAudioTrack(options.defaultAudioTrack);
    if (!isNullOrUndefined(options.defaultTextTrack)) {
        warnOnce("The `defaultTextTrack` loadVideo option is deprecated.\n" +
            "Please use the `preferredTextTracks` constructor option or the" +
            "`setPreferredTextTracks` method instead");
    }
    var defaultTextTrack = normalizeTextTrack(options.defaultTextTrack);
    var hideNativeSubtitle = !DEFAULT_SHOW_NATIVE_SUBTITLE;
    if (!isNullOrUndefined(options.hideNativeSubtitle)) {
        warnOnce("The `hideNativeSubtitle` loadVideo option is deprecated");
        hideNativeSubtitle = !!options.hideNativeSubtitle;
    }
    var manualBitrateSwitchingMode = (_e = options.manualBitrateSwitchingMode) !== null && _e !== void 0 ? _e : DEFAULT_MANUAL_BITRATE_SWITCHING_MODE;
    if (textTrackMode === "html") {
        // TODO Better way to express that in TypeScript?
        if (isNullOrUndefined(options.textTrackElement)) {
            throw new Error("You have to provide a textTrackElement " +
                "in \"html\" textTrackMode.");
        }
        else if (!(options.textTrackElement instanceof HTMLElement)) {
            throw new Error("textTrackElement should be an HTMLElement.");
        }
        else {
            textTrackElement = options.textTrackElement;
        }
    }
    else if (!isNullOrUndefined(options.textTrackElement)) {
        log.warn("API: You have set a textTrackElement without being in " +
            "an \"html\" textTrackMode. It will be ignored.");
    }
    if (!isNullOrUndefined(options.startAt)) {
        // TODO Better way to express that in TypeScript?
        if (options.startAt.wallClockTime
            instanceof Date) {
            var wallClockTime = options.startAt
                .wallClockTime.getTime() / 1000;
            startAt = objectAssign({}, options.startAt, { wallClockTime: wallClockTime });
        }
        else {
            startAt = options.startAt;
        }
    }
    var networkConfig = isNullOrUndefined(options.networkConfig) ?
        {} :
        { manifestRetry: options.networkConfig.manifestRetry,
            offlineRetry: options.networkConfig.offlineRetry,
            segmentRetry: options.networkConfig.segmentRetry };
    // TODO without cast
    /* tslint:disable no-object-literal-type-assertion */
    return { autoPlay: autoPlay,
        defaultAudioTrack: defaultAudioTrack,
        defaultTextTrack: defaultTextTrack,
        hideNativeSubtitle: hideNativeSubtitle,
        keySystems: keySystems,
        lowLatencyMode: lowLatencyMode,
        manualBitrateSwitchingMode: manualBitrateSwitchingMode,
        manifestUpdateUrl: manifestUpdateUrl,
        minimumManifestUpdateInterval: minimumManifestUpdateInterval,
        networkConfig: networkConfig,
        startAt: startAt,
        textTrackElement: textTrackElement,
        textTrackMode: textTrackMode,
        transport: transport,
        transportOptions: transportOptions,
        url: url };
    /* tslint:enable no-object-literal-type-assertion */
}
export { parseConstructorOptions, parseLoadVideoOptions, };