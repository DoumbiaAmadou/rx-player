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
import { concat as observableConcat, defer as observableDefer, map, mergeMap, of as observableOf, } from "rxjs";
import log from "../../log";
import cleanOldLoadedSessions from "./clean_old_loaded_sessions";
import createSession from "./create_session";
import isSessionUsable from "./utils/is_session_usable";
/**
 * Handle MediaEncryptedEvents sent by a HTMLMediaElement:
 * Either create a MediaKeySession, recuperate a previous MediaKeySession or
 * load a persistent session.
 *
 * Some previously created MediaKeySession can be closed in this process to
 * respect the maximum limit of concurrent MediaKeySession, as defined by the
 * `EME_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS` config property.
 *
 * You can refer to the events emitted to know about the current situation.
 * @param {Event} initializationDataInfo
 * @param {Object} handledInitData
 * @param {Object} mediaKeysInfos
 * @returns {Observable}
 */
export default function getSession(initializationData, stores, wantedSessionType, maxSessionCacheSize) {
    return observableDefer(function () {
        /**
         * Store previously-loaded MediaKeySession with the same initialization data, if one.
         */
        var previousLoadedSession = null;
        var loadedSessionsStore = stores.loadedSessionsStore, persistentSessionsStore = stores.persistentSessionsStore;
        var entry = loadedSessionsStore.getAndReuse(initializationData);
        if (entry !== null) {
            previousLoadedSession = entry.mediaKeySession;
            if (isSessionUsable(previousLoadedSession)) {
                log.info("EME: Reuse loaded session", previousLoadedSession.sessionId);
                return observableOf({ type: "loaded-open-session",
                    value: { mediaKeySession: previousLoadedSession,
                        sessionType: entry.sessionType, initializationData: initializationData } });
            }
            else if (persistentSessionsStore !== null) {
                // If the session is not usable anymore, we can also remove it from the
                // PersistentSessionsStore.
                // TODO Are we sure this is always what we want?
                persistentSessionsStore.delete(initializationData);
            }
        }
        return (previousLoadedSession != null ?
            loadedSessionsStore.closeSession(initializationData) :
            observableOf(null)).pipe(mergeMap(function () {
            return observableConcat(cleanOldLoadedSessions(loadedSessionsStore, maxSessionCacheSize), createSession(stores, initializationData, wantedSessionType)
                .pipe(map(function (evt) { return ({ type: evt.type,
                value: { mediaKeySession: evt.value.mediaKeySession,
                    sessionType: evt.value.sessionType, initializationData: initializationData } }); })));
        }));
    });
}
