/**
 * System Resource Catalog.
 */

export const RESOURCE_CATALOG: Record<string, any> = {
  'matter.product': { id: 'matter.product', label: 'Products' },
  'matter.menu_item': { id: 'matter.menu_item', label: 'Menu Items' },
};

export function getResourceIds() { return Object.keys(RESOURCE_CATALOG); }
export function isValidResource(id: string) { return Boolean(RESOURCE_CATALOG[id]); }
