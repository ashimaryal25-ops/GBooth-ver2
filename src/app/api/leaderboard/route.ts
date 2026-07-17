import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const leaderboardPath = path.join(process.cwd(), 'public', 'ghost-runner', 'leaderboard.json');

export async function GET() {
  try {
    if (fs.existsSync(leaderboardPath)) {
      const data = fs.readFileSync(leaderboardPath, 'utf8');
      return NextResponse.json(JSON.parse(data));
    }
  } catch (e) {
    console.error("Failed to read leaderboard", e);
  }
  return NextResponse.json([]);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    fs.writeFileSync(leaderboardPath, JSON.stringify(data, null, 2));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Failed to write leaderboard", e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
