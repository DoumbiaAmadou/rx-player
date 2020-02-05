/**
 * Copyright 2019 CANAL+ Group
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

import { IDBPDatabase } from "idb";
import { EMPTY, merge, of, Subject, throwError } from "rxjs";
import {
 bufferCount,
 catchError,
 distinctUntilKeyChanged,
 filter,
 map,
 mapTo,
 mergeMap,
 reduce,
 tap,
 timeout,
} from "rxjs/operators";

import { IContentProtection } from "../../../../../core/eme";
import { SegmentPipelineCreator } from "../../../../../core/pipelines";
import { IContentDownloaderEvents, IEmitterTrigger, IInitSettings } from "../../types";
import { IndexedDBError, SegmentConstuctionError } from "../../utils";
import ContentManager from "../context/ContentsManager";
import { ContentType } from "../context/types";
import EMETransaction from "../drm/keySystems";
import { manifestLoader } from "./manifest";
import { handleSegmentPipelineFromContexts } from "./segment";
import { ICustomSegment, IInitGroupedSegments, IInitSegment } from "./types";

/**
 * This function take care of downloading the init segment for VIDEO/AUDIO/TEXT
 * buffer type.
 * Then, he also find out the nextSegments we have to download.
 *
 * @param {IInitSettings} object Arguments we need to start the download.
 * @param {IDBPDatabase} db The current opened IndexedDB instance
 * @returns {Observable<IInitGroupedSegments>} An observable containing
 * Initialization segments downloaded and next segments to download
 *
 */
export function initDownloader$(
  { contentID, url, quality, videoQualityPicker, transport, keySystems }: IInitSettings,
  db: IDBPDatabase,
  emitter: IEmitterTrigger<IContentDownloaderEvents>
) {
  return manifestLoader(url, transport).pipe(
    mergeMap(({ manifest, transportPipelines }) => {
      const segmentPipelineCreator = new SegmentPipelineCreator<any>(
        transportPipelines,
        {
          lowLatencyMode: false,
        }
      );
      const contentProtection$ = new Subject<IContentProtection>();
      const contentManager = new ContentManager(
        manifest,
        quality,
        videoQualityPicker
      );
      return of(contentManager.getContextsForCurrentSession()).pipe(
        mergeMap(globalCtx => {
          const { video, audio, text } = contentManager.getContextsFormatted(
            globalCtx
          );
          return merge(
            keySystems !== undefined && Object.keys(keySystems).length > 0
            ? EMETransaction(
              keySystems,
              {
                contentID,
                contentProtection$,
              },
              db
            ).pipe(
              filter(({ emeEvtType }) =>
                emeEvtType === "session-message" ||
                emeEvtType === "session-updated"
              ),
              distinctUntilKeyChanged("emeEvtType"),
              bufferCount(2),
              timeout(2000),
              catchError((err) => {
                if (err instanceof Error && err.name !== "TimeoutError") {
                  return throwError(err);
                }
                return of("handShakesEMEDone");
              }),
              mapTo({ type: "eme" }))
            : EMPTY,
            handleSegmentPipelineFromContexts(video, ContentType.VIDEO, {
              segmentPipelineCreator,
              isInitData: true,
              type: "start",
            }),
            handleSegmentPipelineFromContexts(audio, ContentType.AUDIO, {
              segmentPipelineCreator,
              isInitData: true,
              type: "start",
            }),
            handleSegmentPipelineFromContexts(text, ContentType.TEXT, {
              segmentPipelineCreator,
              isInitData: true,
              type: "start",
            })
          );
        }),
        catchError((err) => {
          if (err instanceof Error) {
            emitter.trigger("error", {
              action: "download",
              contentID,
              error: err !== undefined ? err : new Error("An Unexpected error happened"),
            });
          }
          return EMPTY;
        }),
        mergeMap((initSegment) => {
          if (initSegment.type === "eme") {
            return EMPTY;
          }
          const initSegmentCustomSegment = initSegment as ICustomSegment;
          if (initSegmentCustomSegment.chunkData.contentProtection !== undefined) {
            contentProtection$.next({
              type: "cenc",
              data: initSegmentCustomSegment.chunkData.contentProtection,
            });
          }
          return of(initSegmentCustomSegment);
        }),
        tap(({ ctx, chunkData, contentType }) => {
          const { id: representationID } = ctx.representation;
          const { time } = ctx.segment;
          db.put("segments", {
            contentID,
            segmentKey: `init--${representationID}--${contentID}`,
            data: chunkData.data,
            size: chunkData.data.byteLength,
            contentProtection: chunkData.contentProtection,
          }).catch((err: Error) => {
            throw new IndexedDBError(`
              ${contentID}: Impossible to store the current INIT
              segment (${contentType}) at ${time}: ${err.message}
            `);
          });
        }),
        map(({ ctx, contentType }) => {
          const durationForCurrentPeriod = ctx.period.duration;
          if (durationForCurrentPeriod === undefined) {
            throw new SegmentConstuctionError(`
              Impossible to get future video segments for ${contentType} buffer,
              the duration should be an valid integer but: ${durationForCurrentPeriod}
            `);
          }
          const nextSegments = ctx.representation.index.getSegments(
            0,
            durationForCurrentPeriod
          );
          return {
            nextSegments,
            ctx,
            segmentPipelineCreator,
            contentType,
          };
        })
      );
    }),
    reduce<IInitSegment, IInitGroupedSegments>(
      (
        acc,
        {
          nextSegments,
          ctx: { period, adaptation, representation, manifest },
          contentType,
          segmentPipelineCreator,
        }
      ) => {
        acc.progress.totalSegments += nextSegments.length;
        acc[contentType].push({
          nextSegments,
          period,
          adaptation,
          representation,
          id: representation.id as string,
        });
        return { ...acc, segmentPipelineCreator, manifest };
      },
      {
        progress: { percentage: 0, segmentsDownloaded: 0, totalSegments: 0 },
        video: [],
        audio: [],
        text: [],
        segmentPipelineCreator: null,
        manifest: null,
        type: "start",
      }
    )
  );
}