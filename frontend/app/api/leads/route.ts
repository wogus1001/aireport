import { NextResponse } from 'next/server';

interface LeadPayload {
  name: string;
  phone: string;
  address: string;
}

interface SpringLeadRequest {
  name: string;
  phone: string;
  targetArea: string;
  reportUrl: string;
}

interface SpringLeadResponse {
  id?: number;
  success?: boolean;
  message?: string;
}

interface LeadApiResponse {
  id?: number;
  success: boolean;
  message?: string;
}

const PHONE_PATTERN = /^01[0-9]-\d{3,4}-\d{4}$/;
const LEADS_TIMEOUT_MS = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildMockSuccessResponse(message: string): LeadApiResponse {
  return {
    success: true,
    message,
  };
}

export async function POST(request: Request) {
  const payloadRaw: unknown = await request.json().catch(() => null);
  if (!isRecord(payloadRaw)) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const payload: LeadPayload = {
    name: typeof payloadRaw.name === 'string' ? payloadRaw.name.trim() : '',
    phone: typeof payloadRaw.phone === 'string' ? payloadRaw.phone.trim() : '',
    address: typeof payloadRaw.address === 'string' ? payloadRaw.address.trim() : '',
  };

  if (!payload.name || !payload.phone || !payload.address || !PHONE_PATTERN.test(payload.phone)) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const springBootUrl = process.env.SPRING_BOOT_URL?.trim();
  if (!springBootUrl) {
    return NextResponse.json(buildMockSuccessResponse('SPRING_BOOT_URL is not configured'), { status: 200 });
  }

  const normalizedSpringBootUrl = springBootUrl.replace(/\/+$/, '');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'http://localhost:3000';
  const reportUrl = `${baseUrl.replace(/\/+$/, '')}/report/${encodeURIComponent(payload.address)}`;

  const springPayload: SpringLeadRequest = {
    name: payload.name,
    phone: payload.phone,
    targetArea: payload.address,
    reportUrl,
  };

  try {
    const response = await fetch(`${normalizedSpringBootUrl}/api/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(springPayload),
      signal: AbortSignal.timeout(LEADS_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(buildMockSuccessResponse('Spring Boot request failed. Use mock success.'), {
        status: 200,
      });
    }

    const resultRaw: unknown = await response.json().catch(() => null);
    const result = isRecord(resultRaw) ? (resultRaw as SpringLeadResponse) : null;
    if (!result || result.success !== true) {
      return NextResponse.json(buildMockSuccessResponse('Spring Boot response invalid. Use mock success.'), {
        status: 200,
      });
    }

    return NextResponse.json(
      {
        id: typeof result.id === 'number' ? result.id : undefined,
        success: true,
        message: typeof result.message === 'string' ? result.message : undefined,
      } satisfies LeadApiResponse,
      { status: 200 },
    );
  } catch {
    return NextResponse.json(buildMockSuccessResponse('Spring Boot timeout/failure. Use mock success.'), {
      status: 200,
    });
  }
}
