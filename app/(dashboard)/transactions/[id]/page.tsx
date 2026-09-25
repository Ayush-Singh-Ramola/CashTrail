import TransactionDetails from "./transaction-details";

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TransactionDetails transactionId={id} />;
}
