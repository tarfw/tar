import { router } from 'expo-router';

export interface DeepLinkParams {
  module?: string;
  item?: string;
  id?: string;
}

/**
 * Handle deep linking with module and item parameters
 * Example URLs:
 * - tar2://workspace?module=space&item=123
 * - tar2://ai?item=456
 * - tar2://tasks
 * - tar2://people
 */
export const handleDeepLink = (route: string, params?: DeepLinkParams) => {
  // Construct the route with parameters
  let targetRoute = route;
  
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    
    if (params.module) searchParams.set('module', params.module);
    if (params.item) searchParams.set('item', params.item);
    if (params.id) searchParams.set('id', params.id);
    
    targetRoute = `${route}?${searchParams.toString()}`;
  }
  
  router.push(targetRoute as any);
};

/**
 * Parse deep link parameters from URL search params
 */
export const parseDeepLinkParams = (searchParams: Record<string, string | string[]>): DeepLinkParams => {
  const params: DeepLinkParams = {};
  
  if (searchParams.module && typeof searchParams.module === 'string') {
    params.module = searchParams.module;
  }
  
  if (searchParams.item && typeof searchParams.item === 'string') {
    params.item = searchParams.item;
  }
  
  if (searchParams.id && typeof searchParams.id === 'string') {
    params.id = searchParams.id;
  }
  
  return params;
};

/**
 * Generate a deep link URL for sharing
 */
export const generateDeepLink = (route: string, params?: DeepLinkParams): string => {
  let url = `tar2://${route.replace(/^\//, '')}`;
  
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    
    if (params.module) searchParams.set('module', params.module);
    if (params.item) searchParams.set('item', params.item);
    if (params.id) searchParams.set('id', params.id);
    
    url += `?${searchParams.toString()}`;
  }
  
  return url;
};