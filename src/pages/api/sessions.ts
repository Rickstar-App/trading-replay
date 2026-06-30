import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import { validateSymbol, validateInterval, getCacheDir } from '@/lib/api-utils';
import type { SessionsResponse, ApiError } from '@/lib/types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<SessionsResponse | ApiError>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'GET only' });
  }

  const { symbol, interval } = req.query;

  if (
    typeof symbol !== 'string' || !validateSymbol(symbol) ||
    typeof interval !== 'string' || !validateInterval(interval)
  ) {
    return res.status(400).json({ error: 'invalid_params', message: 'Invalid symbol or interval' });
  }

  const cacheDir = getCacheDir(symbol, interval);

  if (!fs.existsSync(cacheDir)) {
    return res.status(200).json({ dates: [] });
  }

  const files = fs.readdirSync(cacheDir);
  const dates = files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  return res.status(200).json({ dates });
}
