import { ThreadSnapExecutor } from './ThreadSnapExecutor';
import { executeLockdownMore } from '../common/lockdown/lockdown-more';

// Lockdown is already applied in LavaMoat
executeLockdownMore();

ThreadSnapExecutor.initialize();
