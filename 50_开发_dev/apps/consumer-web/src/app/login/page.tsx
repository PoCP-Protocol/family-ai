'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent } from 'react';

export default function LoginPage() {
	const router = useRouter(); const [phone, setPhone] = useState(''); const [code, setCode] = useState(''); const [message, setMessage] = useState(''); const [sent, setSent] = useState(false);
	async function requestCode() { const response = await fetch('/api/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) }); setMessage(response.ok ? '验证码已发送，请输入验证码。' : '验证码发送失败，请稍后重试。'); setSent(response.ok); }
	async function verifyCode() { const response = await fetch('/api/auth/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code }) }); if (!response.ok) return setMessage('验证码无效或已过期，请重新获取。'); const contexts = await fetch('/api/session/contexts'); if (!contexts.ok) return setMessage('登录成功，但家庭上下文暂时不可用。'); const { contexts: familyContexts } = await contexts.json() as { contexts: unknown[] }; router.push(familyContexts.length === 1 ? '/today' : familyContexts.length === 0 ? '/onboarding' : '/select-family'); }
	const updatePhone = (event: ChangeEvent<HTMLInputElement>) => setPhone((event as unknown as { currentTarget: { value: string } }).currentTarget.value); const updateCode = (event: ChangeEvent<HTMLInputElement>) => setCode((event as unknown as { currentTarget: { value: string } }).currentTarget.value);
	return <main className="main" style={{maxWidth:560,margin:'0 auto'}}><span className="eyebrow">Family · 家庭成长工作台</span><h1>登录</h1><p>登录通过 HttpOnly Cookie 会话完成，浏览器不会保存 Bearer Token。</p><section className="card"><label htmlFor="phone">手机号</label><input id="phone" className="search" value={phone} onChange={updatePhone} placeholder="请输入手机号" /><button className="button" style={{marginTop:16}} onClick={requestCode}>获取验证码</button>{sent && <><label htmlFor="code">验证码</label><input id="code" className="search" value={code} onChange={updateCode} placeholder="请输入验证码" /><button className="button" style={{marginTop:16}} onClick={verifyCode}>登录并继续</button></>}{message && <p role="status">{message}</p>}</section><p><Link href="/">返回首页</Link></p></main>;
}
