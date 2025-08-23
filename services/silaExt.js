import sila from '../services/silaSDK.js';
import { v4 as uuidv4 } from 'uuid';

export const moveToCompanyWallet = async ({ amount, userHandle, userPrivateKey,accountName,source_id }) => {
    const idempotencyId = uuidv4();

    return sila.issueSila(
        parseInt(amount, 10),
        userHandle,
        userPrivateKey,
        accountName || 'default',
        undefined, // descriptor
        undefined, // business_uuid
        undefined, // processing_type
        undefined, // cardName
        source_id, // source_id
        process.env.SILA_COMPANY_WALLET,
        idempotencyId,
    );
}

export const getTransactionStatusById = async (txId, userHandle, userPrivateKey) => {
  const resp = await sila.getTransactions(userHandle, userPrivateKey, {
    transaction_id: txId,  // <-- filter goes here
    page: 1,
    per_page: 1,
  });

  const list = resp?.data?.transactions || [];
  const tx = list.find(t => t.transaction_id === txId) || list[0] || null;

  // Sila sometimes uses `status`, sometimes `transaction_status`
  const rawStatus =
    (tx?.status ?? tx?.transaction_status ?? resp?.data?.transaction_status ?? '').toLowerCase();

  // Fallback if nothing came back yet
  const status = rawStatus || 'pending';

  return { raw: resp, status, tx };
};
