import { createInternalStream } from './manage.js';
import HLS from 'hls-parser';
import path from "node:path";

function transformObject(streamInfo, hlsObject) {
    if (hlsObject === undefined) {
        return (object) => transformObject(streamInfo, object);
    }

    const fullUrl = hlsObject.uri.startsWith("/")
        ? new URL(hlsObject.uri, streamInfo.url).toString()
        : new URL(path.join(streamInfo.url, "/../", hlsObject.uri)).toString();
    hlsObject.uri = createInternalStream(fullUrl, streamInfo);

    return hlsObject;
}

function transformMasterPlaylist(streamInfo, hlsPlaylist) {
    const makeInternalStream = transformObject(streamInfo);

    const makeInternalVariants = (variant) => {
        variant = transformObject(streamInfo, variant);
        variant.video = variant.video.map(makeInternalStream);
        variant.audio = variant.audio.map(makeInternalStream);
        return variant;
    };
    hlsPlaylist.variants = hlsPlaylist.variants.map(makeInternalVariants);

    return hlsPlaylist;
}

function transformMediaPlaylist(streamInfo, hlsPlaylist) {
    const makeInternalSegments = transformObject(streamInfo);
    hlsPlaylist.segments = hlsPlaylist.segments.map(makeInternalSegments);
    hlsPlaylist.prefetchSegments = hlsPlaylist.prefetchSegments.map(makeInternalSegments);
    return hlsPlaylist;
}

const HLS_MIME_TYPES = ["application/vnd.apple.mpegurl", "audio/mpegurl", "application/x-mpegURL"];

export function isHlsRequest (req) {
    return HLS_MIME_TYPES.includes(req.headers['content-type']);
}

export async function handleHlsPlaylist(streamInfo, req, res) {
    let hlsPlaylist = await req.body.text();
    hlsPlaylist = HLS.parse(hlsPlaylist);

    hlsPlaylist = hlsPlaylist.isMasterPlaylist
        ? transformMasterPlaylist(streamInfo, hlsPlaylist)
        : transformMediaPlaylist(streamInfo, hlsPlaylist);

    hlsPlaylist = HLS.stringify(hlsPlaylist);

    res.send(hlsPlaylist);
}
