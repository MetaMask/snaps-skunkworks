// 0xd36e6170 - 0x80000000
export const SIP_6_MAGIC_VALUE = `1399742832'` as `${number}'`;

// `${bytesToNumber(keccak256('Snaps state encryption').slice(0, 4))}'`
export const STATE_ENCRYPTION_MAGIC_VALUE = `572232532'` as `${number}'`;

export type MagicValue = typeof SIP_6_MAGIC_VALUE;
