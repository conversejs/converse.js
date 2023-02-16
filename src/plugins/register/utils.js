import { _converse, api } from '@converse/headless/core';

export async function setActiveForm (value) {
    await api.waitUntil('controlBoxInitialized');
    const controlbox = _converse.chatboxes.get('controlbox');
    controlbox.set({ 'active-form': value });
}
