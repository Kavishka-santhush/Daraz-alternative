'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/hooks/use-catalog';
import { useSellerShops, useCreateProduct, useUpdateProduct, type ProductInput } from '@/hooks/use-seller';
import { num } from '@/lib/utils';
import type { Category, Product } from '@/types';

const productSchema = z.object({
  shopId: z.string().min(1, 'Choose a shop'),
  categoryId: z.string().min(1, 'Choose a category'),
  title: z.string().min(3, 'Title is too short').max(160),
  subtitle: z.string().max(200).optional(),
  description: z.string().min(10, 'Add a fuller description').max(20000),
  sku: z.string().min(1, 'SKU is required').max(64),
  condition: z.enum(['NEW', 'REFURBISHED', 'USED']),
  shippingClass: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'HEAVY', 'FRAGILE']),
  originalPrice: z.coerce.number().min(0, 'Price must be positive'),
  salePrice: z.coerce.number().min(0).optional(),
  stockQuantity: z.coerce.number().int('Whole numbers only').min(0),
  tags: z.string().optional(),
  submitForReview: z.boolean(),
});
type FormValues = z.infer<typeof productSchema>;

interface FlatCat {
  id: string;
  label: string;
}

/** Depth-first flatten of the category tree into indented select options. */
function flatten(nodes: Category[] | undefined, depth = 0, out: FlatCat[] = []): FlatCat[] {
  for (const n of nodes ?? []) {
    out.push({ id: n.id, label: `${'– '.repeat(depth)}${n.name}` });
    if (n.children?.length) flatten(n.children, depth + 1, out);
  }
  return out;
}

/**
 * Create / edit product form. When `product` is provided it runs in edit mode
 * (shop is fixed, "submit for review" is exposed via a normal save).
 */
export function ProductForm({ product }: { product?: Product }) {
  const isEdit = Boolean(product);
  const { data: categories, isLoading: catsLoading } = useCategories();
  const { data: shops, isLoading: shopsLoading } = useSellerShops();
  const create = useCreateProduct();
  const update = useUpdateProduct();

  const options = useMemo(() => flatten(categories), [categories]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      condition: 'NEW',
      shippingClass: 'SMALL',
      submitForReview: false,
      stockQuantity: 0,
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        shopId: product.shop?.id ?? '',
        categoryId: product.category?.id ?? '',
        title: product.title,
        subtitle: product.subtitle ?? undefined,
        description: product.description,
        sku: product.sku,
        condition: (product.condition as FormValues['condition']) ?? 'NEW',
        shippingClass: 'SMALL',
        originalPrice: num(product.originalPrice),
        salePrice: product.salePrice ? num(product.salePrice) : undefined,
        stockQuantity: product.stockQuantity,
        tags: (product.tags ?? []).join(', '),
        submitForReview: false,
      });
    }
  }, [product, reset]);

  // Auto-select the shop when there's only one (create mode).
  useEffect(() => {
    if (!isEdit && shops && shops.length === 1) setValue('shopId', shops[0].id);
  }, [shops, isEdit, setValue]);

  const shopId = watch('shopId');
  const categoryId = watch('categoryId');
  const condition = watch('condition');
  const shippingClass = watch('shippingClass');
  const submitForReview = watch('submitForReview');

  const onSubmit = handleSubmit((v) => {
    const tags = (v.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (isEdit && product) {
      const body: Partial<ProductInput> = {
        categoryId: v.categoryId,
        title: v.title,
        subtitle: v.subtitle,
        description: v.description,
        sku: v.sku,
        condition: v.condition,
        shippingClass: v.shippingClass,
        originalPrice: v.originalPrice,
        salePrice: v.salePrice,
        stockQuantity: v.stockQuantity,
        tags,
      };
      update.mutate({ id: product.id, body });
    } else {
      const body: ProductInput = {
        shopId: v.shopId,
        categoryId: v.categoryId,
        title: v.title,
        subtitle: v.subtitle,
        description: v.description,
        sku: v.sku,
        condition: v.condition,
        shippingClass: v.shippingClass,
        originalPrice: v.originalPrice,
        salePrice: v.salePrice,
        stockQuantity: v.stockQuantity,
        tags,
        submitForReview: v.submitForReview,
      };
      create.mutate(body, {
        onSuccess: () => {
          reset({ condition: 'NEW', shippingClass: 'SMALL', submitForReview: false, stockQuantity: 0, shopId: v.shopId });
        },
      });
    }
  });

  const pending = create.isPending || update.isPending;

  if (shopsLoading || catsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Create mode needs at least one shop; steer sellers to onboarding otherwise.
  if (!isEdit && (!shops || shops.length === 0)) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <h2 className="text-lg font-semibold">Create a shop first</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Products belong to a shop. Set up your shop before adding listings.
          </p>
          <Button asChild variant="brand" className="mt-4">
            <Link href="/seller/shop">Go to My shop</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit product' : 'Add product'}</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/seller/products">Back to products</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          {!isEdit && (
            <div className="space-y-1">
              <Label>Shop</Label>
              <Select value={shopId} onValueChange={(v) => setValue('shopId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a shop" />
                </SelectTrigger>
                <SelectContent>
                  {shops?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.shopId && <p className="text-xs text-destructive">{errors.shopId.message}</p>}
            </div>
          )}

          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={(v) => setValue('categoryId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Product name" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="subtitle">Subtitle (optional)</Label>
            <Input id="subtitle" placeholder="Short selling point" {...register('subtitle')} />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={6} placeholder="Detail, materials, use cases…" {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" placeholder="Internal code" {...register('sku')} />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Condition</Label>
            <Select value={condition} onValueChange={(v) => setValue('condition', v as FormValues['condition'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="REFURBISHED">Refurbished</SelectItem>
                <SelectItem value="USED">Used</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Shipping class</Label>
            <Select
              value={shippingClass}
              onValueChange={(v) => setValue('shippingClass', v as FormValues['shippingClass'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SMALL">Small</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LARGE">Large</SelectItem>
                <SelectItem value="HEAVY">Heavy</SelectItem>
                <SelectItem value="FRAGILE">Fragile</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="originalPrice">Original price</Label>
            <Input id="originalPrice" type="number" step="0.01" min="0" {...register('originalPrice')} />
            {errors.originalPrice && <p className="text-xs text-destructive">{errors.originalPrice.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="salePrice">Sale price (optional)</Label>
            <Input id="salePrice" type="number" step="0.01" min="0" {...register('salePrice')} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="stockQuantity">Stock quantity</Label>
            <Input id="stockQuantity" type="number" min="0" {...register('stockQuantity')} />
            {errors.stockQuantity && <p className="text-xs text-destructive">{errors.stockQuantity.message}</p>}
          </div>

          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input id="tags" placeholder="wireless, bluetooth, black" {...register('tags')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          {!isEdit && (
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={submitForReview}
                onCheckedChange={(c) => setValue('submitForReview', c === true)}
              />
              <span>
                Submit for review
                <span className="block text-xs text-muted-foreground">
                  Sends the listing to moderation; otherwise it stays a draft.
                </span>
              </span>
            </label>
          )}
          <div className="flex justify-end gap-2 sm:ml-auto">
            <Button asChild variant="outline">
              <Link href="/seller/products">Cancel</Link>
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
