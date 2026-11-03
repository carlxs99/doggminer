import { describe, expect, it } from 'vitest';
import { appLink, payoutChannelMessage, payoutUser, txLink, welcomeMessage, withdrawalReturnedMessage } from '@/lib/bot-messages';

describe('bot chat messages', () => {
  it('passes a /start ref_<id> invite on to the mini app so the inviter keeps the referral', () => {
    expect(appLink('ref_6334940213')).toBe('https://t.me/Doggminerbot/miner?startapp=ref_6334940213');
    expect(welcomeMessage('Carlos', 'ref_42').buttons[0]?.[0]?.url).toBe('https://t.me/Doggminerbot/miner?startapp=ref_42');
  });
  it('ignores anything that is not a valid invite', () => {
    expect(appLink('hello')).toBe('https://t.me/Doggminerbot/miner');
    expect(appLink(null)).toBe('https://t.me/Doggminerbot/miner');
  });
  it('escapes names so a player name cannot inject markup', () => {
    expect(welcomeMessage('<b>x</b>').text).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
  it('a returned withdrawal gives back amount plus the 70 fee', () => {
    expect(withdrawalReturnedMessage({ amount: 1000, fee: 70 }).text).toContain('1,070 $DOGG');
  });
  it('links base64 and hex transaction hashes to Tonviewer', () => {
    const hex = 'd2b811dfde8ce710a8c15cf75f43337da950335e91b2e1b1be3eb1872c2b4cde';
    expect(txLink(hex, 'x')).toBe(`https://tonviewer.com/transaction/${hex}`);
    expect(txLink('0rgR396M5xCowVz3X0MzfalQM16RsuGxvj6xhywrTN4=', 'x')).toBe(`https://tonviewer.com/transaction/${hex}`);
    expect(txLink(null, 'UQabc')).toBe('https://tonviewer.com/UQabc');
  });
  it('announces a payout with the user, the amount and a Tonviewer button to the transaction', () => {
    const hex = 'c95d590cde9c15373874399985a1fbd8e538273cf34b90f2285cf11be3218eb9';
    const m = payoutChannelMessage({ user: payoutUser('Antonio', 'Antoyr'), amount: 1000, address: 'UQabc', txHash: hex });
    expect(m.text).toContain('👤 User: @Antoyr');
    expect(m.text).toContain('1,000 $DOGG');
    expect(m.buttons[0]?.[0]).toEqual({ text: '🔎 View on Tonviewer', url: `https://tonviewer.com/transaction/${hex}` });
  });
  it('never shows the Telegram id of a player without @username', () => {
    expect(payoutUser('Carlos', null)).toBe('Carlos');
    expect(payoutUser(null, null)).toBe('Anonymous miner');
  });
});
