import { ChildProcessSnapExecutor } from './ChildProcessSnapExecutor';
import { executeLockdownMore } from '../common/lockdown/lockdown-more';

// Lockdown is already applied in LavaMoat
executeLockdownMore();

ChildProcessSnapExecutor.initialize();
