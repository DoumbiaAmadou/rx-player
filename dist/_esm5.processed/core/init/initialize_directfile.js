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
 * /!\ This file is feature-switchable.
 * It always should be imported through the `features` object.
 */
import { EMPTY, filter, ignoreElements, merge as observableMerge, mergeMap, switchMap, of as observableOf, share, take, } from "rxjs";
import { clearElementSrc, setElementSrc$, } from "../../compat";
import log from "../../log";
import deferSubscriptions from "../../utils/defer_subscriptions";
import createEMEManager from "./create_eme_manager";
import emitLoadedEvent from "./emit_loaded_event";
import initialSeekAndPlay from "./initial_seek_and_play";
import StallAvoider from "./stall_avoider";
import throwOnMediaError from "./throw_on_media_error";
import updatePlaybackRate from "./update_playback_rate";
/**
 * calculate initial time as a position in seconds.
 * @param {HTMLMediaElement} mediaElement
 * @param {Object|undefined} startAt
 * @returns {number}
 */
function getDirectFileInitialTime(mediaElement, startAt) {
    if (startAt == null) {
        return 0;
    }
    if (startAt.position != null) {
        return startAt.position;
    }
    else if (startAt.wallClockTime != null) {
        return startAt.wallClockTime;
    }
    else if (startAt.fromFirstPosition != null) {
        return startAt.fromFirstPosition;
    }
    var duration = mediaElement.duration;
    if (duration == null || !isFinite(duration)) {
        log.warn("startAt.fromLastPosition set but no known duration, " +
            "beginning at 0.");
        return 0;
    }
    if (typeof startAt.fromLastPosition === "number") {
        return Math.max(0, duration + startAt.fromLastPosition);
    }
    else if (startAt.percentage != null) {
        var percentage = startAt.percentage;
        if (percentage >= 100) {
            return duration;
        }
        else if (percentage <= 0) {
            return 0;
        }
        var ratio = +percentage / 100;
        return duration * ratio;
    }
    return 0;
}
/**
 * Launch a content in "Directfile mode".
 * @param {Object} directfileOptions
 * @returns {Observable}
 */
export default function initializeDirectfileContent(_a) {
    var autoPlay = _a.autoPlay, keySystems = _a.keySystems, mediaElement = _a.mediaElement, playbackObserver = _a.playbackObserver, speed = _a.speed, startAt = _a.startAt, url = _a.url;
    clearElementSrc(mediaElement);
    if (url == null) {
        throw new Error("No URL for a DirectFile content");
    }
    // Start everything! (Just put the URL in the element's src).
    var linkURL$ = setElementSrc$(mediaElement, url);
    log.debug("Init: Calculating initial time");
    var initialTime = function () { return getDirectFileInitialTime(mediaElement, startAt); };
    log.debug("Init: Initial time calculated:", initialTime);
    var seekAndPlay$ = initialSeekAndPlay({ mediaElement: mediaElement, playbackObserver: playbackObserver, startTime: initialTime,
        mustAutoPlay: autoPlay }).seekAndPlay$;
    // Create EME Manager, an observable which will manage every EME-related
    // issue.
    var emeManager$ = linkURL$.pipe(mergeMap(function () { return createEMEManager(mediaElement, keySystems, EMPTY); }), deferSubscriptions(), share());
    // Translate errors coming from the media element into RxPlayer errors
    // through a throwing Observable.
    var mediaError$ = throwOnMediaError(mediaElement);
    var observation$ = playbackObserver.observe(true);
    // Set the speed set by the user on the media element while pausing a
    // little longer while the buffer is empty.
    var playbackRate$ = updatePlaybackRate(mediaElement, speed, observation$)
        // NOTE As of now (RxJS 7.4.0), RxJS defines `ignoreElements` default
        // first type parameter as `any` instead of the perfectly fine `unknown`,
        // leading to linter issues, as it forbids the usage of `any`.
        // This is why we're disabling the eslint rule.
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-argument */
        .pipe(ignoreElements());
    /**
     * Observable trying to avoid various stalling situations, emitting "stalled"
     * events when it cannot, as well as "unstalled" events when it get out of one.
     */
    var stallAvoider$ = StallAvoider(playbackObserver, null, EMPTY, EMPTY);
    /**
     * Emit a "loaded" events once the initial play has been performed and the
     * media can begin playback.
     * Also emits warning events if issues arise when doing so.
     */
    var loadingEvts$ = emeManager$.pipe(filter(function isEMEReady(evt) {
        if (evt.type === "created-media-keys") {
            evt.value.canAttachMediaKeys.setValue(true);
            return true;
        }
        return evt.type === "eme-disabled" || evt.type === "attached-media-keys";
    }), take(1), mergeMap(function () { return seekAndPlay$; }), switchMap(function (evt) {
        if (evt.type === "warning") {
            return observableOf(evt);
        }
        return emitLoadedEvent(observation$, mediaElement, null, true);
    }));
    return observableMerge(loadingEvts$, emeManager$, mediaError$, playbackRate$, stallAvoider$);
}
