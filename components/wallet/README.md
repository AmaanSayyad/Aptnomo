# Wallet Components

This directory contains wallet-related components for the CreditNomo application.

## TransactionStatus Component

The `TransactionStatus` component displays transaction information with real-time status updates and block explorer integration.

### Features

- **Transaction Hash Display**: Shows the full transaction hash with truncation support
- **Copy to Clipboard**: One-click copy functionality for the transaction hash
- **Real-time Status Updates**: Automatically polls for transaction status updates
- **Block Explorer Link**: Direct link to view the transaction on CreditCoin testnet block explorer
- **Status Indicators**: Visual indicators for pending, confirmed, and failed transactions

### Usage

```tsx
import { TransactionStatus } from '@/components/wallet/TransactionStatus';

// Basic usage with auto-refresh
<TransactionStatus 
  txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  status="pending"
/>

// With custom styling
<TransactionStatus 
  txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  status="confirmed"
  className="my-4"
/>

// Without auto-refresh
<TransactionStatus 
  txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  status="confirmed"
  autoRefresh={false}
/>
```

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `txHash` | `string` | Yes | - | The transaction hash to display |
| `status` | `'pending' \| 'confirmed' \| 'failed'` | No | `'pending'` | Initial transaction status |
| `autoRefresh` | `boolean` | No | `true` | Whether to automatically poll for status updates |
| `className` | `string` | No | `''` | Additional CSS classes to apply |

### Integration Examples

#### In DepositModal

```tsx
import { TransactionStatus } from '@/components/wallet/TransactionStatus';

const [txHash, setTxHash] = useState<string | null>(null);
const [txStatus, setTxStatus] = useState<'pending' | 'confirmed' | 'failed'>('pending');

// After transaction is submitted
const handleDeposit = async () => {
  // ... transaction logic
  const hash = await sendTransaction();
  setTxHash(hash);
  setTxStatus('pending');
};

// In render
{txHash && (
  <TransactionStatus 
    txHash={txHash}
    status={txStatus}
  />
)}
```

#### In WithdrawModal

```tsx
import { TransactionStatus } from '@/components/wallet/TransactionStatus';

const [withdrawTxHash, setWithdrawTxHash] = useState<string | null>(null);

// After withdrawal API call
const handleWithdraw = async () => {
  const result = await fetch('/api/withdraw', {
    method: 'POST',
    body: JSON.stringify({ userAddress, amount }),
  });
  const data = await result.json();
  setWithdrawTxHash(data.txHash);
};

// In render
{withdrawTxHash && (
  <TransactionStatus 
    txHash={withdrawTxHash}
    status="pending"
  />
)}
```

### Requirements Validated

This component validates the following requirements from the CreditNomo migration spec:

- **13.1**: Display transaction hash with link to CreditCoin block explorer
- **13.2**: Display transaction hash with link to CreditCoin block explorer (withdrawal)
- **13.3**: Format block explorer URLs as `https://creditcoin-testnet.blockscout.com/tx/{txHash}`
- **13.4**: Display transaction status (pending, confirmed, failed) in real-time
- **13.5**: Allow users to copy transaction hash to clipboard

### Testing

The component includes comprehensive unit tests covering:

- Display and UI rendering
- Copy to clipboard functionality
- Auto-refresh status updates
- Error handling
- Requirements validation

Run tests with:

```bash
npm test -- components/wallet/__tests__/TransactionStatus.test.tsx
```

### Styling

The component uses Tailwind CSS classes and follows the CreditNomo design system:

- **Pending**: Yellow color with spinning loader icon
- **Confirmed**: Green color with check circle icon
- **Failed**: Red color with X circle icon
- **Links**: Cyan color (`#00f5ff`) matching the CreditNomo brand

### Block Explorer Integration

The component automatically generates the correct block explorer URL using the `getExplorerTxUrl` helper from `@/lib/ctc/config`:

```typescript
// Format: https://creditcoin-testnet.blockscout.com/tx/{txHash}
const explorerUrl = getExplorerTxUrl(txHash);
```

### Auto-refresh Behavior

When `autoRefresh` is enabled (default):

- Pending transactions are checked every 5 seconds
- Status automatically updates when transaction is confirmed or fails
- Polling stops when transaction reaches a final state (confirmed/failed)
- Errors during status checks are logged but don't break the UI

### Accessibility

- All interactive elements have proper ARIA labels
- Copy button shows visual feedback (check icon) on success
- Status changes are clearly indicated with icons and text
- Links open in new tabs with proper `rel` attributes
