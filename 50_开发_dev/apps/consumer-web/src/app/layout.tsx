import type { Metadata } from 'next';
import { familyTokenCss } from '@family/design-tokens';
import './styles.css';

export const metadata: Metadata = { title: 'Family · 家庭成长工作台', description: 'Family 家庭成长工作台' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><head><style dangerouslySetInnerHTML={{ __html: familyTokenCss }} /></head><body>{children}</body></html>; }
