import converse from '../../shared/api/public.js';
import Device from './device.js';
import Devices from './devices.js';
import DeviceList from './devicelist.js';
import DeviceLists from './devicelists.js';
import './plugin.js';

const { Strophe } = converse.env;

Strophe.addNamespace('OMEMO_DEVICELIST', Strophe.NS.OMEMO + '.devicelist');
Strophe.addNamespace('OMEMO_VERIFICATION', Strophe.NS.OMEMO + '.verification');
Strophe.addNamespace('OMEMO_WHITELISTED', Strophe.NS.OMEMO + '.whitelisted');
Strophe.addNamespace('OMEMO_BUNDLES', Strophe.NS.OMEMO + '.bundles');

export { Device, Devices, DeviceList, DeviceLists  };
