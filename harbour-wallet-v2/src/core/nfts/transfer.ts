// NFT transfer builders (pure; no keys). EVM: ERC-721 / ERC-1155 `safeTransferFrom` call plans (signed by the background with viem).
// Solana: classic SPL/Metaplex NFTs through wallet-core TokenTransfer / CreateAndTransferToken (compressed + programmable NFTs are refused).
import { encodeFunctionData, getAddress, isAddress, parseAbi } from 'viem';
import { TW } from '@trustwallet/wallet-core';
import type { NftItem } from './types';

const erc721 = parseAbi(['function safeTransferFrom(address from, address to, uint256 tokenId)']);
const erc1155 = parseAbi(['function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)']);
export interface EvmNftTx { to: `0x${string}`; data: `0x${string}`; value: 0n }
export function evmNftTransfer(item: Pick<NftItem, 'contract' | 'id' | 'standard' | 'transferable'>, from: string, to: string, quantity = 1n): EvmNftTx {
  if (!item.transferable) throw new Error('This NFT cannot be transferred from Harbour');
  const ok = (a: string) => typeof a === 'string' && isAddress(a.toLowerCase()); // mixed-case input may carry a foreign/absent checksum
  if (!ok(item.contract) || !ok(from) || !ok(to)) throw new Error('Invalid address');
  if (/^0x0{40}$/i.test(to)) throw new Error('Cannot send to the zero address');
  if (!/^\d{1,78}$/.test(item.id)) throw new Error('Invalid token id');
  const [c, f, t, id] = [getAddress(item.contract.toLowerCase()), getAddress(from.toLowerCase()), getAddress(to.toLowerCase()), BigInt(item.id)];
  if (item.standard === 'ERC-721') return { to: c, data: encodeFunctionData({ abi: erc721, functionName: 'safeTransferFrom', args: [f, t, id] }), value: 0n };
  if (item.standard === 'ERC-1155') {
    if (quantity <= 0n) throw new Error('Quantity must be positive');
    return { to: c, data: encodeFunctionData({ abi: erc1155, functionName: 'safeTransferFrom', args: [f, t, id, quantity, '0x'] }), value: 0n };
  }
  throw new Error('Unknown token standard');
}

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export interface SolNftArgs { sender: string; recipient: string; mint: string; senderTokenAddress: string; recipientTokenAddress: string; recipientHasAccount: boolean; token2022: boolean; blockhash: string; privateKey: Uint8Array }
export function buildSolanaNftInput(core: any, a: SolNftArgs) {
  for (const v of [a.sender, a.recipient, a.mint, a.senderTokenAddress, a.recipientTokenAddress]) if (!B58.test(v)) throw new Error('Invalid Solana address');
  if (a.sender === a.recipient) throw new Error('Cannot send an NFT to yourself');
  const P = TW.Solana.Proto;
  const tokenProgramId = a.token2022 ? P.TokenProgramId.Token2022Program : P.TokenProgramId.TokenProgram;
  const base = { privateKey: a.privateKey, recentBlockhash: a.blockhash, sender: a.sender, txEncoding: P.Encoding.Base58 };
  return a.recipientHasAccount
    ? P.SigningInput.create({ ...base, tokenTransferTransaction: { tokenMintAddress: a.mint, senderTokenAddress: a.senderTokenAddress, recipientTokenAddress: a.recipientTokenAddress, amount: 1, decimals: 0, tokenProgramId } })
    : P.SigningInput.create({ ...base, createAndTransferTokenTransaction: { recipientMainAddress: a.recipient, tokenMintAddress: a.mint, recipientTokenAddress: a.recipientTokenAddress, senderTokenAddress: a.senderTokenAddress, amount: 1, decimals: 0, tokenProgramId } });
}
export function signSolanaNft(core: any, a: SolNftArgs): string {
  const P = TW.Solana.Proto;
  const out = P.SigningOutput.decode(core.AnySigner.sign(P.SigningInput.encode(buildSolanaNftInput(core, a)).finish(), core.CoinType.solana));
  if (out.error || out.errorMessage || !out.encoded) throw new Error(out.errorMessage || 'Signing failed');
  return out.encoded;
}
