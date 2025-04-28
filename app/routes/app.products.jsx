import { json, redirect } from '@remix-run/node';
import { Form, useLoaderData } from '@remix-run/react';
import { authenticate } from '../shopify.server';
import { GraphqlQueryError } from '@shopify/shopify-api';

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  // Use string query directly as per Shopify GraphQL client API
  const query = `#graphql
  query getProducts {
    products(first: 10) {
      edges {
        node {
          id
          title
          biddingEnabled: metafield(namespace: "custom", key: "bidding_enabled") {
            id
            value
          }
          minPrice: metafield(namespace: "custom", key: "min_price") {
            id
            value
          }
        }
      }
    }
  }`;

  try {
    const response = await admin.graphql(query);
    const result = await response.json();
    if (!result.data?.products) {
      console.error('Invalid Shopify response:', result);
      throw new Response('No products found', { status: 500 });
    }
    const products = result.data.products.edges.map(edge => edge.node);
    return json({ products });
  } catch (error) {
    console.error('Shopify GraphQL fetch error:', error);
    throw new Response('Failed to fetch products', { status: 500 });
  }
}

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const productId = form.get('productId')?.toString();
  const enabled = form.has('enabled') ? 'true' : 'false';
  const minPriceValue = form.get('minPrice')?.toString() || '0';
  const biddingEnabledId = form.get('bidding_enabledMetafieldId')?.toString();
  const minPriceId = form.get('min_priceMetafieldId')?.toString();

  // Prepare metafields array with full payload (namespace, key, type, value) and optional id
  const metafields = [
    {
      ...(biddingEnabledId && { id: biddingEnabledId }),
      namespace: 'custom',
      key: 'bidding_enabled',
      type: 'boolean',
      value: enabled,
    },
    {
      ...(minPriceId && { id: minPriceId }),
      namespace: 'custom',
      key: 'min_price',
      type: 'number_decimal',
      value: minPriceValue,
    },
  ];

  const mutation = `#graphql
    mutation updateBidSettings($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id }
        userErrors { field message }
      }
    }
  `;

  try {
    const response = await admin.graphql(mutation, { variables: { input: { id: productId, metafields } } });
    const result = await response.json();

    if (result.data?.productUpdate.userErrors.length) {
      console.error('Shopify user errors:', result.data.productUpdate.userErrors);
      return json({ errors: result.data.productUpdate.userErrors }, { status: 400 });
    }

    return redirect('/products');
  } catch (error) {
    if (error instanceof GraphqlQueryError) {
      console.error(error);
      return json({ errors: error.response.errors }, { status: 500 });
    }
    console.error('Unexpected error:', error);
    return new Response('Kuch ghalat hogaya', { status: 500 });
  }
};

export default function ProductsPage() {
  const { products } = useLoaderData();

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Products</h1>
      {products.map(product => (
        <div
          key={product.id}
          style={{ marginBottom: '1.5rem', borderBottom: '1px solid #ccc', paddingBottom: '1rem' }}
        >
          <h2>{product.title}</h2>
          <Form method="post">
            <input type="hidden" name="productId" value={product.id} />
            <input
              type="hidden"
              name="bidding_enabledMetafieldId"
              value={product.biddingEnabled?.id ?? ''}
            />
            <input
              type="hidden"
              name="min_priceMetafieldId"
              value={product.minPrice?.id ?? ''}
            />

            <label style={{ display: 'block', margin: '0.5rem 0' }}>
              Start Bidding:
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={product.biddingEnabled?.value === 'true'}
              />
            </label>

            <label style={{ display: 'block', margin: '0.5rem 0' }}>
               Minimum Price (Rs):
              <input
                type="number"
                name="minPrice"
                step="0.01"
                defaultValue={product.minPrice?.value || ''}
              />
            </label>

            <button type="submit">Save</button>
          </Form>
        </div>
      ))}
    </div>
  );
}
