import { _converse, api } from '@converse/headless';

export async function setActiveForm (value) {
    await api.waitUntil('controlBoxInitialized');

    const { chatboxes } = _converse.state;
    const controlbox = chatboxes.get('controlbox');
    controlbox.set({ 'active-form': value });
}

export function routeToForm (event) {
    if (location.hash === '#converse/login') {
        event?.preventDefault();
        setActiveForm('login');
    } else if (location.hash === '#converse/register') {
        event?.preventDefault();
        setActiveForm('register');
    }
}
