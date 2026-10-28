// Original Harbour art and licensed Lucide glyphs replace unlicensed extracted Lottie files.
import { ShieldCheck, Wallet, QrCode, Anchor } from 'lucide-react';
export function Animation({name,className=''}:{name:string;className?:string}){
 if(name==='globe')return <div className={className} aria-hidden="true"><img src="/illustrations/harbour.svg" alt=""/></div>;
 const Glyph=name.includes('wallet')||name==='import'?Wallet:name.includes('qr')?QrCode:name==='security'||name==='lock'?ShieldCheck:Anchor;
 return <div className={`ob-purpose-illustration ${className}`} aria-hidden="true"><span className="ob-orbit"/><span className="ob-glyph"><Glyph size={60} strokeWidth={1.3}/></span><span className="ob-illustration-caption">{name==='security'?'PRIVATE BY DESIGN':name==='import'?'BRING YOUR WALLET HOME':name.includes('qr')?'CONNECT WITH CONFIDENCE':'READY FOR WHAT’S NEXT'}</span></div>;
}
