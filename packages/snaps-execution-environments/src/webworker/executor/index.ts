import { WebWorkerSnapExecutor } from './WebWorkerSnapExecutor';
import { executeLockdownEvents } from '../../common/lockdown/lockdown-events';
import { executeLockdownMore } from '../../common/lockdown/lockdown-more';

// Lockdown is already applied in LavaMoat
executeLockdownMore();
executeLockdownEvents();

WebWorkerSnapExecutor.initialize();
