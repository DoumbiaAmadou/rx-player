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
import PPromise from "pinkie";
import { concat } from "../../utils/byte_parsing";
import request from "../../utils/request";
import byteRange from "../utils/byte_range";
/**
 * Perform a request for an initialization segment, agnostic to the container.
 * @param {string} url
 * @param {Object} segment
 * @param {CancellationSignal} cancelSignal
 * @param {Object} callbacks
 * @returns {Promise}
 */
export default function initSegmentLoader(url, segment, cancelSignal, callbacks) {
    if (segment.range === undefined) {
        return request({ url: url,
            responseType: "arraybuffer",
            cancelSignal: cancelSignal,
            onProgress: callbacks.onProgress })
            .then(function (data) { return ({ resultType: "segment-loaded",
            resultData: data }); });
    }
    if (segment.indexRange === undefined) {
        return request({ url: url,
            headers: { Range: byteRange(segment.range) },
            responseType: "arraybuffer",
            cancelSignal: cancelSignal,
            onProgress: callbacks.onProgress })
            .then(function (data) { return ({ resultType: "segment-loaded",
            resultData: data }); });
    }
    // range and indexRange are contiguous (99% of the cases)
    if (segment.range[1] + 1 === segment.indexRange[0]) {
        return request({ url: url,
            headers: { Range: byteRange([segment.range[0],
                    segment.indexRange[1]]) },
            responseType: "arraybuffer",
            cancelSignal: cancelSignal,
            onProgress: callbacks.onProgress })
            .then(function (data) { return ({ resultType: "segment-loaded",
            resultData: data }); });
    }
    var rangeRequest$ = request({ url: url,
        headers: { Range: byteRange(segment.range) },
        responseType: "arraybuffer",
        cancelSignal: cancelSignal,
        onProgress: callbacks.onProgress });
    var indexRequest$ = request({ url: url,
        headers: { Range: byteRange(segment.indexRange) },
        responseType: "arraybuffer",
        cancelSignal: cancelSignal,
        onProgress: callbacks.onProgress });
    return PPromise.all([rangeRequest$, indexRequest$])
        .then(function (_a) {
        var initData = _a[0], indexData = _a[1];
        var data = concat(new Uint8Array(initData.responseData), new Uint8Array(indexData.responseData));
        var sendingTime = Math.min(initData.sendingTime, indexData.sendingTime);
        var receivedTime = Math.max(initData.receivedTime, indexData.receivedTime);
        return { resultType: "segment-loaded",
            resultData: { url: url,
                responseData: data,
                size: initData.size + indexData.size,
                duration: receivedTime - sendingTime,
                sendingTime: sendingTime,
                receivedTime: receivedTime } };
    });
}