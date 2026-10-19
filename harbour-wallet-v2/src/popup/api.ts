import browser from 'webextension-polyfill';
export const bg = (msg: any) => browser.runtime.sendMessage(msg) as Promise<any>;
