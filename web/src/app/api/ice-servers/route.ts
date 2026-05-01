import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/src/lib/firebase-admin';

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

function buildIceServers(): RTCIceServer[] {
  const fromJson = process.env.WEBRTC_ICE_SERVERS_JSON;
  if (fromJson) {
    try {
      const parsed = JSON.parse(fromJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as RTCIceServer[];
    } catch {
      console.error('[ice-servers] Invalid WEBRTC_ICE_SERVERS_JSON');
    }
  }

  const turnUrls = (process.env.WEBRTC_TURN_URLS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const username = process.env.WEBRTC_TURN_USERNAME;
  const credential = process.env.WEBRTC_TURN_CREDENTIAL;

  if (turnUrls.length > 0 && username && credential) {
    return [...DEFAULT_ICE_SERVERS, { urls: turnUrls, username, credential }];
  }

  return DEFAULT_ICE_SERVERS;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await getAdminAuth().verifyIdToken(auth.slice(7));
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  return NextResponse.json({ iceServers: buildIceServers() });
}
