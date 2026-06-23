export type FieldType = 'text' | 'number' | 'select' | 'textarea' | 'date' | 'phone' | 'email' | 'rating';

export interface SkillField {
  name: string;
  type: FieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface CreatesMapping {
  table: 'form' | 'matter' | 'motion';
  formType?: string;
  formScope?: string;
  titleField?: string;
  titleTemplate?: string;
  dataFields?: string[];
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  vertical: string;
  icon: string;
  keywords?: string[];
  fields: SkillField[];
  execute?: (values: Record<string, any>) => {
    formType: string;
    formScope: string;
    title: string;
    data: Record<string, any>;
  };
  creates?: CreatesMapping;
  custom?: boolean;
  /** True for built-in skills seeded from seed.ts */
  builtIn?: boolean;
}
