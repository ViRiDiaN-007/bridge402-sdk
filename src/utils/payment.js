/**
 * Payment utilities for x402 payments (Solana)
 */

import { Connection, PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, getMint, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

/**
 * Build exact payment transaction for x402
 */
export async function buildExactPaymentTx({
  connection,
  payerPublicKey,
  feePayerPublicKey,
  recipientPublicKey,
  mintPublicKey,
  amountAtomic,
  createRecipientATAIfMissing = true,
}) {
  const payerPubkey = payerPublicKey instanceof PublicKey ? payerPublicKey : new PublicKey(payerPublicKey);
  const feePayerPubkey = feePayerPublicKey instanceof PublicKey ? feePayerPublicKey : new PublicKey(feePayerPublicKey);
  const recipientPubkey = recipientPublicKey instanceof PublicKey ? recipientPublicKey : new PublicKey(recipientPublicKey);
  const mintPubkey = mintPublicKey instanceof PublicKey ? mintPublicKey : new PublicKey(mintPublicKey);

  const instructions = [];

  // Facilitator requires ComputeBudget instructions in positions 0 and 1
  instructions.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }));
  instructions.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }));

  // Determine program (token vs token-2022)
  const mintInfo = await connection.getAccountInfo(mintPubkey, 'confirmed');
  const programId = mintInfo?.owner?.toBase58() === TOKEN_2022_PROGRAM_ID.toBase58()
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;

  // Fetch mint to get decimals
  const mint = await getMint(connection, mintPubkey, undefined, programId);

  // Derive source and destination ATAs
  const sourceAta = await getAssociatedTokenAddress(mintPubkey, payerPubkey, false, programId);
  const destinationAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey, false, programId);

  // Check if source ATA exists
  const sourceAtaInfo = await connection.getAccountInfo(sourceAta, 'confirmed');
  if (!sourceAtaInfo) {
    throw new Error(`Payer does not have an Associated Token Account for ${mintPubkey.toBase58()}`);
  }

  // Create ATA for destination if missing
  if (createRecipientATAIfMissing) {
    const destAtaInfo = await connection.getAccountInfo(destinationAta, 'confirmed');
    if (!destAtaInfo) {
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
      instructions.push(
        new TransactionInstruction({
          keys: [
            { pubkey: feePayerPubkey, isSigner: true, isWritable: true },
            { pubkey: destinationAta, isSigner: false, isWritable: true },
            { pubkey: recipientPubkey, isSigner: false, isWritable: false },
            { pubkey: mintPubkey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: programId, isSigner: false, isWritable: false },
          ],
          programId: ASSOCIATED_TOKEN_PROGRAM_ID,
          data: Buffer.from([0]),
        })
      );
    }
  }

  // TransferChecked instruction
  instructions.push(
    createTransferCheckedInstruction(
      sourceAta,
      mintPubkey,
      destinationAta,
      payerPubkey,
      amountAtomic,
      mint.decimals,
      [],
      programId
    )
  );

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed');

  const message = new TransactionMessage({
    payerKey: feePayerPubkey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

