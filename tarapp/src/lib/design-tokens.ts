export interface DesignTokens {
  name: string;
  colors: Record<string, string>;
  typography: Record<
    string,
    { fontFamily: string; fontSize: number; fontWeight: '400' | '500' | '600' | '700' | '800' | '900' | 'normal' | 'bold' }
  >;
  rounded: Record<string, number>;
  spacing: Record<string, number>;
  components: Record<string, Record<string, string>>;
}

export function parseDesignTokens(designYaml: any): DesignTokens {
  const colors = designYaml.colors || {};
  const typographyRaw = designYaml.typography || {};
  const roundedRaw = designYaml.rounded || {};
  const spacingRaw = designYaml.spacing || {};
  const components = designYaml.components || {};

  const typography: any = {};
  Object.entries(typographyRaw).forEach(([key, val]: [string, any]) => {
    let fontSize = 14;
    if (val.fontSize) {
      const match = val.fontSize.match(/([\d.]+)/);
      if (match) {
        const num = parseFloat(match[1]);
        fontSize = val.fontSize.includes('rem') ? num * 16 : num;
      }
    }
    
    let fontWeight: any = '400';
    if (val.fontWeight) {
      const fw = String(val.fontWeight);
      if (['400', '500', '600', '700', '800', '900', 'normal', 'bold'].includes(fw)) {
        fontWeight = fw;
      } else {
        fontWeight = 'normal';
      }
    }

    typography[key] = {
      fontFamily: val.fontFamily || 'System',
      fontSize,
      fontWeight,
    };
  });

  const rounded: any = {};
  const defaultRounded: Record<string, number> = { sm: 6, md: 12, lg: 16 };
  Object.entries(roundedRaw).forEach(([key, val]: [string, any]) => {
    if (typeof val === 'number') {
      rounded[key] = val;
    } else if (typeof val === 'string') {
      const match = val.match(/([\d.]+)/);
      rounded[key] = match ? parseFloat(match[1]) : (defaultRounded[key] || 8);
    } else {
      rounded[key] = defaultRounded[key] || 8;
    }
  });

  const spacing: any = {};
  const defaultSpacing: Record<string, number> = { xs: 4, sm: 8, md: 16, lg: 24 };
  Object.entries(spacingRaw).forEach(([key, val]: [string, any]) => {
    if (typeof val === 'number') {
      spacing[key] = val;
    } else if (typeof val === 'string') {
      const match = val.match(/([\d.]+)/);
      spacing[key] = match ? parseFloat(match[1]) : (defaultSpacing[key] || 16);
    } else {
      spacing[key] = defaultSpacing[key] || 16;
    }
  });

  return {
    name: designYaml.name || 'Workspace',
    colors,
    typography,
    rounded,
    spacing,
    components,
  };
}

export function resolveTokenValue(val: any, tokens: DesignTokens): any {
  if (typeof val !== 'string') return val;
  const match = val.match(/^{(colors|typography|rounded|spacing)\.([^}]+)}/);
  if (match) {
    const [_, group, key] = match;
    const resolvedGroup = (tokens as any)[group];
    if (resolvedGroup && resolvedGroup[key] !== undefined) {
      return resolvedGroup[key];
    }
  }
  return val;
}
