// src/features/transaction/transaction-history.resolver.ts

import { combineResolvers } from 'graphql-resolvers';
import { protectEntities } from '../../utils/auth-middleware';
import TransactionHistoryController from './transaction-history.controller';

const transactionHistoryResolvers = {
  Query: {
    // Get driver earnings with period filtering
    getMyEarnings: combineResolvers(
      protectEntities(['DRIVER']),
      TransactionHistoryController.getMyEarnings
    ),

    // Get driver payout history
    getMyPayouts: combineResolvers(
      protectEntities(['DRIVER']),
      TransactionHistoryController.getMyPayouts
    ),

    // Get wallet summary
    getMyWalletSummary: combineResolvers(
      protectEntities(['DRIVER', 'CUSTOMER']),
      TransactionHistoryController.getMyWalletSummary
    ),

    // Get transaction receipt
    getTransactionReceipt: combineResolvers(
      protectEntities(['DRIVER', 'CUSTOMER']),
      TransactionHistoryController.getTransactionReceipt
    ),
  },
};

export default transactionHistoryResolvers;
