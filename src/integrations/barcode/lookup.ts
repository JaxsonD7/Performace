/**
 * Turns a scanned barcode into a product name via Open Food Facts — a free,
 * open, no-key-required product database, called directly from the browser
 * like the rest of this app's direct-to-third-party integrations (no server
 * of this app's own). Not every barcode is in it; that's handled as a
 * normal miss, not an error — the scan flow falls back to a blank,
 * hand-typed name rather than getting stuck.
 */

export interface ProductLookup {
  name: string;
  /** The package size as printed ("500 g", "12 x 330 ml"), too free-form to force into quantity/unit — surfaced as a note instead. */
  packageSize?: string;
}

export async function lookupProduct(barcode: string): Promise<ProductLookup | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,quantity`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: number;
      product?: { product_name?: string; quantity?: string };
    };
    const name = data.status === 1 ? data.product?.product_name?.trim() : undefined;
    if (!name) return null;
    return { name, packageSize: data.product?.quantity || undefined };
  } catch {
    return null;
  }
}
