'use client';

import { Loader2 } from 'lucide-react';
import { ProductForm } from '@/components/seller/product-form';
import { useSellerProduct } from '@/hooks/use-seller';

export default function EditProductPage({ params }: { params: { id: string } }) {
  const { data, isLoading } = useSellerProduct(params.id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!data) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Product not found.</p>;
  }

  return <ProductForm product={data} />;
}
