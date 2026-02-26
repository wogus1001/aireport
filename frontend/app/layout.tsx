import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-kr',
});

export const metadata: Metadata = {
  title: '내일사장 상권분석 리포트',
  description: '주소 기반 상권 분석 리포트를 확인하고 잠금 해제를 진행합니다.',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang='ko'>
      <body className={`${notoSansKr.variable} min-h-screen bg-slate-50 text-slate-900`}>
        {children}
      </body>
    </html>
  );
}
