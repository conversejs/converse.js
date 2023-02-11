import DeviceList from './devicelist.js';
import { Collection } from '@converse/skeletor/src/collection';

/**
 * @class
 * @namespace _converse.DeviceLists
 * @memberOf _converse
 */
const DeviceLists = Collection.extend({ model: DeviceList });

export default DeviceLists;
