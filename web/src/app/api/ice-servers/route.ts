import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/src/lib/firebase-admin';

const STUN_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

function buildIceServers(): RTCIceServer[] {
  // Priority 1: fully custom JSON blob (overrides everything)
  const fromJson = process.env.WEBRTC_ICE_SERVERS_JSON;
  if (fromJson) {
    try {
      const parsed = JSON.parse(fromJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as RTCIceServer[];
    } catch {
      console.error('[ice-servers] Invalid WEBRTC_ICE_SERVERS_JSON, falling through');
    }
  }

  const username = process.env.WEBRTC_TURN_USERNAME;
  const credential = process.env.WEBRTC_TURN_CREDENTIAL;

  // Priority 2: single TURN host → generate UDP + TCP + TLS URLs automatically
  const turnHost = process.env.WEBRTC_TURN_HOST;
  if (turnHost && username && credential) {
    return [
      ...STUN_SERVERS,
      {
        urls: [
          `turn:${turnHost}:3478`,               // UDP (default, lowest latency)
          `turn:${turnHost}:3478?transport=tcp`,  // TCP (punches through symmetric NAT)
          `turns:${turnHost}:5349`,               // TLS (survives restrictive firewalls)
          `turns:${turnHost}:443`,                // TLS on 443 (bypasses deep packet inspection)
        ],
        username,
        credential,
      },
    ];
  }

  // Priority 3: legacy WEBRTC_TURN_URLS comma-separated list
  const turnUrls = (process.env.WEBRTC_TURN_URLS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (turnUrls.length > 0 && username && credential) {
    return [...STUN_SERVERS, { urls: turnUrls, username, credential }];
  }

  console.warn('[ice-servers] No TURN server configured — calls may fail behind symmetric NAT');
  return STUN_SERVERS;
}

const cachedServers = buildIceServers();

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

  return NextResponse.json(
    { iceServers: cachedServers },
    {
      headers: {
        // Short cache — credentials may rotate; callers should refetch before each call
        'Cache-Control': 'private, max-age=300',
      },
    }
  );
}
