import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('google-site-verification: google9e513362f436402a.html', {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
